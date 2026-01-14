import { Hono } from 'hono'
import { cors } from 'hono/cors'

export interface Bindings {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  CORS_ORIGIN?: string
}

// Allowed headers to forward to OpenAI
const ALLOWED_REQUEST_HEADERS = new Set([
  'content-type',
  'user-agent',
  'accept',
  'accept-encoding',
  'accept-language',
  'openai-organization',
  'openai-project',
])

// Allowed headers to forward back to client
const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type',
  'content-encoding',
  'content-length',
  'cache-control',
  'openai-organization',
  'openai-processing-ms',
  'openai-version',
  'x-request-id',
])

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
    
    // Validate that the path starts with /v1/ to prevent path traversal
    if (!path.startsWith('/v1/')) {
      return c.json({ error: 'Invalid path' }, 400)
    }
    
    // Get base URL from environment or use default
    const baseUrl = c.env.OPENAI_BASE_URL || 'https://api.openai.com'
    const url = new URL(path, baseUrl)
    
    // Get API key from Authorization header or environment
    let apiKey = c.env.OPENAI_API_KEY
    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '')
    }
    
    if (!apiKey) {
      return c.json({ error: 'Unauthorized: Missing API key' }, 401)
    }
    
    // Forward only allowed headers to OpenAI
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${apiKey}`)
    
    for (const [key, value] of c.req.raw.headers.entries()) {
      if (ALLOWED_REQUEST_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value)
      }
    }
    
    // Determine if the request should include a body
    const method = c.req.method
    const shouldIncludeBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    
    const response = await fetch(url.toString(), {
      method: method,
      headers: headers,
      body: shouldIncludeBody ? c.req.raw.body : undefined,
    })
    
    // Filter response headers to only include safe ones
    const responseHeaders = new Headers()
    for (const [key, value] of response.headers.entries()) {
      if (ALLOWED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    }
    
    // Return the OpenAI response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  })

export default app
