import { describe, expect, it } from 'vitest'
import app from '../../../index'
import { pick } from 'lodash-es'

const MOCK_ENV = {
  API_KEY: import.meta.env.VITE_API_KEY,
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
}

describe('OpenAI Responses API', async () => {
  it('should return 401 without authorization', async () => {
    const r = await app.request(
      'v1/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: 'Hello, world!',
        }),
      },
      MOCK_ENV,
    )

    expect(r.status).eq(401)
    const json = (await r.json()) as any
    expect(json.error).eq('Unauthorized')
  })

  it('should handle OPTIONS request for CORS', async () => {
    const r = await app.request(
      'v1/responses',
      {
        method: 'OPTIONS',
      },
      MOCK_ENV,
    )

    expect(r.status).to.be.oneOf([200, 204])
  })
})
