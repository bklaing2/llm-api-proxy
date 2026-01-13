import { Context, Hono } from 'hono'
import { Bindings } from '../../index'
import OpenAI from 'openai'
import { getModels } from '../common'
import { streamSSE } from 'hono/streaming'

export function openAiRouter(): Hono<{
  Bindings: Bindings
}> {
  const app = new Hono<{
    Bindings: Bindings
  }>()

  app
    .options('/chat/completions', async (c) => {
      return c.json({ body: 'ok' })
    })
    .options('/responses', async (c) => {
      return c.json({ body: 'ok' })
    })
    .use('*', async (c, next) => {
      if (!c.env.API_KEY) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      if (`Bearer ${c.env.API_KEY}` !== c.req.header('Authorization')) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return next()
    })
    .post('/chat/completions', completions)
    .get('/models', models)
    .post('/responses', createResponse)
    .get('/responses/:id', retrieveResponse)
    .delete('/responses/:id', deleteResponse)
    .post('/responses/:id/cancel', cancelResponse)

  return app
}

function getOpenAIClient(c: Context<{ Bindings: Bindings }>): OpenAI {
  return new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  })
}

async function completions(c: Context<{ Bindings: Bindings }>) {
  const req = (await c.req.json()) as
    | OpenAI.ChatCompletionCreateParamsNonStreaming
    | OpenAI.ChatCompletionCreateParamsStreaming
  const list = getModels(c.env as any)
  const llm = list.find((it) => it.supportModels.includes(req.model))
  if (!llm) {
    return c.json({ error: `Model ${req.model} not supported` }, 400)
  }
  if (req.stream) {
    const abortController = new AbortController()
    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => abortController.abort())
        for await (const it of llm.stream(req, abortController.signal)) {
          stream.writeSSE({ data: JSON.stringify(it) })
        }
      },
      async (err, stream) => {
        await stream.writeSSE({
          data: JSON.stringify({
            error: err.message,
          }),
        })
        return stream.close()
      },
    )
  }
  return c.json(await llm?.invoke(req))
}

async function models(c: Context<{ Bindings: Bindings }>) {
  return c.json({
    object: 'list',
    data: getModels(c.env as any).flatMap((it) =>
      it.supportModels.map(
        (model) =>
          ({
            id: model,
            object: 'model',
            owned_by: it.name,
            created: Math.floor(Date.now() / 1000),
          }) as OpenAI.Models.Model,
      ),
    ),
  } as OpenAI.Models.ModelsPage)
}

async function createResponse(c: Context<{ Bindings: Bindings }>) {
  const req = (await c.req.json()) as
    | OpenAI.Responses.ResponseCreateParamsNonStreaming
    | OpenAI.Responses.ResponseCreateParamsStreaming

  const client = getOpenAIClient(c)

  // Check if streaming is requested
  if (req.stream) {
    const abortController = new AbortController()
    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => abortController.abort())
        const responseStream = await client.responses.create({
          ...req,
          stream: true,
        })
        for await (const event of responseStream) {
          if (abortController.signal.aborted) {
            break
          }
          stream.writeSSE({ data: JSON.stringify(event) })
        }
      },
      async (err, stream) => {
        await stream.writeSSE({
          data: JSON.stringify({
            error: err.message,
          }),
        })
        return stream.close()
      },
    )
  }

  // Non-streaming response
  const response = await client.responses.create({
    ...req,
    stream: false,
  })
  return c.json(response)
}

async function retrieveResponse(c: Context<{ Bindings: Bindings }>) {
  const responseId = c.req.param('id')

  const client = getOpenAIClient(c)

  // Check if streaming is requested via query params (per OpenAI API spec)
  const stream = c.req.query('stream') === 'true'

  if (stream) {
    const abortController = new AbortController()
    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => abortController.abort())
        const responseStream = await client.responses.retrieve(responseId, {
          stream: true,
        })
        for await (const event of responseStream) {
          if (abortController.signal.aborted) {
            break
          }
          stream.writeSSE({ data: JSON.stringify(event) })
        }
      },
      async (err, stream) => {
        await stream.writeSSE({
          data: JSON.stringify({
            error: err.message,
          }),
        })
        return stream.close()
      },
    )
  }

  // Non-streaming response
  const response = await client.responses.retrieve(responseId)
  return c.json(response)
}

async function deleteResponse(c: Context<{ Bindings: Bindings }>) {
  const responseId = c.req.param('id')

  const client = getOpenAIClient(c)

  await client.responses.delete(responseId)
  return c.json({ deleted: true, id: responseId })
}

async function cancelResponse(c: Context<{ Bindings: Bindings }>) {
  const responseId = c.req.param('id')

  const client = getOpenAIClient(c)

  const response = await client.responses.cancel(responseId)
  return c.json(response)
}
