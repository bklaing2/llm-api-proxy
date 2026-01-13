import { openai } from '../llm/openai'
import { anthropic, anthropicVertex } from '../llm/anthropic'
import { google } from '../llm/google'
import { deepseek } from '../llm/deepseek'
import { moonshot } from '../llm/moonshot'
import { lingyiwanwu } from '../llm/lingyiwanwu'
import { groq } from '../llm/groq'
import { auzreOpenAI } from '../llm/azure'
import { cohere } from '../llm/cohere'
import { bailian } from '../llm/bailian'
import { ollama } from '../llm/ollama'
import { grok } from '../llm/grok'
import { openrouter } from '../llm/openrouter'
import { cerebras } from '../llm/cerebras'

// --- getModels: Lists all REAL, configured backend providers ---
export function getModels(env: Record<string, string>, openaiApiKey?: string) {
  const models = [
    openai(env, openaiApiKey),
    anthropic(env),
    anthropicVertex(env),
    google(env),
    deepseek(env),
    moonshot(env),
    lingyiwanwu(env),
    groq(env),
    auzreOpenAI(env),
    cohere(env),
    bailian(env),
    ollama(env),
    grok(env),
    openrouter(env),
    cerebras(env),
  ]
  
  // Filter out providers that don't have their required environment variables
  // Special case: OpenAI can work with either env var OR user-provided key
  return models.filter((it) => {
    if (it.name === 'openai') {
      // OpenAI is available if user provides key OR env has key
      return openaiApiKey || env.OPENAI_API_KEY
    }
    return it.requiredEnv.every((key) => key in env)
  })
}
