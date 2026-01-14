import { beforeAll, describe, expect, it } from 'vitest'
import app from '..'
import OpenAI from 'openai'
import { omit } from 'lodash-es'

let mockClient: OpenAI
let realClient: OpenAI

beforeAll(() => {
  // Mock client uses the proxy
  mockClient = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    fetch: async (url, init) => {
      const urlObj = new URL(url as string)
      return app.request(urlObj.pathname + urlObj.search, init as any, {})
    },
  })

  // Real client connects directly to OpenAI
  realClient = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  })
})

describe('OpenAI Proxy', () => {
  describe('chat completions', () => {
    it('should forward non-streaming chat completion requests', async () => {
      const [proxyResult, directResult] = await Promise.all([
        mockClient.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [{ role: 'user', content: 'Say hello!' }],
        }),
        realClient.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [{ role: 'user', content: 'Say hello!' }],
        }),
      ])

      expect(proxyResult).toBeDefined()
      expect(directResult).toBeDefined()
      expect(omit(proxyResult, 'created', 'id', 'system_fingerprint')).toEqual(
        omit(directResult, 'created', 'id', 'system_fingerprint')
      )
    })

    it('should forward streaming chat completion requests', async () => {
      const proxyStream = await mockClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [{ role: 'user', content: 'Count to 3' }],
        stream: true,
      })

      const chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = []
      for await (const chunk of proxyStream) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].object).toBe('chat.completion.chunk')
    })
  })

  describe('models', () => {
    it('should forward model list requests', async () => {
      const models = await mockClient.models.list()
      expect(models.data.length).toBeGreaterThan(0)
      expect(models.data.some(m => m.id.includes('gpt'))).toBe(true)
    })
  })

  describe('authentication', () => {
    it('should reject requests without authorization', async () => {
      const response = await app.request('/v1/models', {
        method: 'GET',
      }, {})
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toContain('Unauthorized')
    })

    it('should accept requests with authorization header', async () => {
      const response = await app.request('/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
      }, {})
      
      expect(response.status).toBe(200)
    })

    it('should use environment API key when provided', async () => {
      const response = await app.request('/v1/models', {
        method: 'GET',
      }, {
        OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
      })
      
      expect(response.status).toBe(200)
    })
  })
})
