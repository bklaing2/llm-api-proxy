import { beforeAll, describe, expect, it } from 'vitest'
import app from '..'
import OpenAI from 'openai'
import { omit } from 'lodash-es'

let mockClient: OpenAI | undefined
let realClient: OpenAI | undefined

beforeAll(() => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  // Only set up OpenAI clients if API key is available
  if (apiKey) {
    // Mock client uses the proxy
    mockClient = new OpenAI({
      apiKey: apiKey,
      fetch: async (url, init) => {
        const urlObj = new URL(url as string)
        return app.request(urlObj.pathname + urlObj.search, init as any, {})
      },
    })

    // Real client connects directly to OpenAI
    realClient = new OpenAI({
      apiKey: apiKey,
    })
  }
})

describe('OpenAI Proxy', () => {
  describe('chat completions', () => {
    it('should forward non-streaming chat completion requests', async () => {
      if (!mockClient || !realClient) {
        console.log('Skipping test: VITE_OPENAI_API_KEY not set')
        return
      }
      
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
      if (!mockClient) {
        console.log('Skipping test: VITE_OPENAI_API_KEY not set')
        return
      }
      
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
      if (!mockClient) {
        console.log('Skipping test: VITE_OPENAI_API_KEY not set')
        return
      }
      
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
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY
      if (!apiKey) {
        console.log('Skipping test: VITE_OPENAI_API_KEY not set')
        return
      }
      
      const response = await app.request('/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }, {})
      
      expect(response.status).toBe(200)
    })
  })

  describe('CORS', () => {
    it('should not set Access-Control-Allow-Origin header when CORS_ORIGIN is not set', async () => {
      // Test OPTIONS preflight request
      const response = await app.request('/v1/models', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      }, {})
      
      // We expect the CORS header to not be set when CORS_ORIGIN is undefined
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should not set Access-Control-Allow-Origin header when CORS_ORIGIN is empty', async () => {
      const response = await app.request('/v1/models', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      }, {
        CORS_ORIGIN: '',
      })
      
      // We expect the CORS header to not be set when CORS_ORIGIN is empty
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should set Access-Control-Allow-Origin header when CORS_ORIGIN is defined', async () => {
      const response = await app.request('/v1/models', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      }, {
        CORS_ORIGIN: 'https://example.com',
      })
      
      // We expect the CORS header to be set to the specified origin
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })

    it('should set Access-Control-Allow-Origin header to * when CORS_ORIGIN is *', async () => {
      const response = await app.request('/v1/models', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      }, {
        CORS_ORIGIN: '*',
      })
      
      // We expect the CORS header to be set to *
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })
})
