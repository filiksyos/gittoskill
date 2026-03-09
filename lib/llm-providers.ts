import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

export type ProviderId = 'openrouter' | 'google'

export const PROVIDER_CONFIG: Record<
  ProviderId,
  { label: string; model: string; keyEnv: string; getKeyUrl: string }
> = {
  openrouter: {
    label: 'OpenRouter',
    model: 'anthropic/claude-sonnet-4.5',
    keyEnv: 'OPENROUTER_API_KEY',
    getKeyUrl: 'https://openrouter.ai/keys',
  },
  google: {
    label: 'Google AI Studio',
    model: 'gemini-2.5-pro',
    keyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
}

export function getModelForProvider(
  provider: ProviderId,
  apiKey: string | undefined
): LanguageModel {
  const config = PROVIDER_CONFIG[provider]
  const key = apiKey?.trim() || process.env[config.keyEnv]?.trim()

  if (!key) {
    throw new Error(
      `API key required for ${config.label}. Provide your key or set ${config.keyEnv} in .env.local. Get a key at ${config.getKeyUrl}`
    )
  }

  if (provider === 'openrouter') {
    const openrouter = createOpenRouter({ apiKey: key })
    return openrouter.chat(config.model)
  }

  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey: key })
    return google(config.model)
  }

  throw new Error(`Unknown provider: ${provider}`)
}

export function validateProvider(value: unknown): value is ProviderId {
  return value === 'openrouter' || value === 'google'
}
