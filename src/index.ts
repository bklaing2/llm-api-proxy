import { Hono } from 'hono'
import { cors } from 'hono/cors'

export interface Bindings {
  OPENAI_API_KEY?: string
  CORS_ORIGIN?: string
}

const OPENAI_BASE_URL = 'https://api.openai.com'

const app = new Hono<{
  Bindings: Bindings
}>()
  .use(
    cors({
      origin: (_origin, c) => {
        return c.env.CORS_ORIGIN || '*'
      },
    }),
  )
  // Forward all /v1/* requests to OpenAI
  .all('/v1/*', async (c) => {
    const path = c.req.path
    const url = new URL(path, OPENAI_BASE_URL)
    
    // Get API key from Authorization header or environment
    let apiKey = c.env.OPENAI_API_KEY
    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '')
    }
    
    if (!apiKey) {
      return c.json({ error: 'Unauthorized: Missing API key' }, 401)
    }
    
    // Forward the request to OpenAI
    const headers = new Headers(c.req.raw.headers)
    headers.set('Authorization', `Bearer ${apiKey}`)
    headers.delete('Host')
    
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers: headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    })
    
    // Return the OpenAI response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  })

export default app
