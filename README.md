# OpenAI API CORS Proxy

## Introduction

A simple proxy server that forwards requests to the OpenAI API, primarily designed to circumvent CORS restrictions when accessing OpenAI's API from browser-based applications.

This proxy accepts OpenAI API requests and forwards them directly to `https://api.openai.com`, allowing you to make API calls from browser environments without CORS issues.

## Deployment

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bklaing2/llm-api-proxy)

### Environment Variables

- `OPENAI_BASE_URL` (Optional): Base URL for the OpenAI API. Defaults to `https://api.openai.com`. Can be configured to use OpenAI-compatible APIs or different OpenAI endpoints.
- `CORS_ORIGIN` (Optional): Allowed CORS domain, e.g. `https://example.com`. If not set, defaults to allowing all origins (`*`).

### Authentication

All requests must include an `Authorization: Bearer <YOUR_OPENAI_API_KEY>` header with a valid OpenAI API key.

## Usage

Once deployed, you can call the OpenAI API through the proxy by replacing the base URL.

### Example: Using curl

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
     "model": "gpt-4o-mini",
     "messages": [
       {
         "role": "user",
         "content": "Hello, world!"
       }
     ]
   }'
```

### Example: Using OpenAI SDK

```ts
const openai = new OpenAI({
  baseURL: 'http://localhost:8787/v1',
  apiKey: '$OPENAI_API_KEY', // Your OpenAI API key
})

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello, world!' }],
})

console.log(response)
```

## API Compatibility

This proxy supports all OpenAI API endpoints, including:

- [/v1/chat/completions](https://platform.openai.com/docs/api-reference/chat/create)
- [/v1/models](https://platform.openai.com/docs/api-reference/models)
- [/v1/completions](https://platform.openai.com/docs/api-reference/completions)
- [/v1/embeddings](https://platform.openai.com/docs/api-reference/embeddings)
- And all other OpenAI API endpoints

All requests are forwarded directly to OpenAI's API with the appropriate authentication headers.

## Why Use This Proxy?

Browser-based applications cannot directly call the OpenAI API due to CORS (Cross-Origin Resource Sharing) restrictions. This lightweight proxy solves that problem by:

1. Accepting requests from your browser application
2. Forwarding them to OpenAI's API with proper headers
3. Returning the response back to your browser

This allows you to build browser-based AI applications without needing a complex backend infrastructure.
