import type { ProviderContext } from '../../../types'

import { z } from 'zod'

import { defineProvider } from '../../registry'

/**
 * Fish Audio through its OpenAI-compatible speech endpoint.
 *
 * NOTICE:
 * The native Fish Audio API (`/v1/tts`) does not answer CORS preflight requests, so a renderer cannot call it.
 * The compat endpoint (`/compat/v1/audio/speech`) does, with `Access-Control-Allow-Origin: *` and the
 * `Authorization` and `Content-Type` headers allowed. Source: preflight against api.fish.audio, checked 2026-11-18.
 * The compat endpoint returns raw PCM unless `response_format` is set, and it refuses unknown parameters such as
 * `instructions`, so this provider sends only the fields that Fish Audio documents, with `mp3` audio.
 * Source: https://docs.fish.audio/developer-guide/compat/migrate-from-openai.md
 */
export const FISH_AUDIO_COMPAT_BASE_URL = 'https://api.fish.audio/compat/v1/'
export const FISH_AUDIO_DEFAULT_MODEL = 'fish-audio/s2.1-pro'

const fishAudioConfigSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string().default(FISH_AUDIO_COMPAT_BASE_URL),
  model: z.string().default(FISH_AUDIO_DEFAULT_MODEL),
  voice: z.string().default(''),
  speed: z.number().optional(),
})

type FishAudioConfig = z.input<typeof fishAudioConfigSchema>

/** The body that Fish Audio receives. */
export interface FishAudioSpeechBody {
  model: string
  input: string
  voice: string
  response_format: 'mp3'
  speed?: number
}

function normalizeBaseUrl(baseUrl: string | undefined) {
  return `${(baseUrl?.trim() || FISH_AUDIO_COMPAT_BASE_URL).replace(/\/+$/, '')}/`
}

/** Keeps the fields that the Fish Audio compat endpoint accepts from an OpenAI-style speech body. */
export function toFishAudioBody(body: Record<string, unknown>, config: Partial<FishAudioConfig>): FishAudioSpeechBody {
  const speed = typeof body.speed === 'number' ? body.speed : config.speed
  const fishBody: FishAudioSpeechBody = {
    model: String(body.model || config.model || FISH_AUDIO_DEFAULT_MODEL),
    input: String(body.input ?? ''),
    voice: String(body.voice ?? config.voice ?? ''),
    response_format: 'mp3',
  }
  if (typeof speed === 'number' && speed !== 1)
    fishBody.speed = speed
  return fishBody
}

function createFishAudioSpeechProvider(config: FishAudioConfig) {
  const apiKey = config.apiKey?.trim() ?? ''
  const baseUrl = normalizeBaseUrl(config.baseUrl)

  return {
    speech: (model?: string) => ({
      apiKey,
      baseURL: baseUrl,
      model: model || config.model || FISH_AUDIO_DEFAULT_MODEL,
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init?.body || typeof init.body !== 'string')
          throw new Error('Invalid request body')

        const body = toFishAudioBody(JSON.parse(init.body) as Record<string, unknown>, config)
        const response = await globalThis.fetch(new URL('audio/speech', baseUrl), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: init.signal,
        })
        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          throw new Error(`Fish Audio request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`)
        }
        return response
      },
    }),
  }
}

function createFishAudioValidators() {
  return {
    validateConfig: [
      ({ t }: ProviderContext) => ({
        id: 'fish-audio-speech:check-config',
        name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-config.title'),
        validator: async (config: FishAudioConfig) => {
          const errors: Array<{ error: unknown }> = []
          if (!config.apiKey?.trim())
            errors.push({ error: new Error('API key is required.') })

          return {
            errors,
            reason: errors.map(item => (item.error as Error).message).join(', '),
            reasonKey: '',
            valid: errors.length === 0,
          }
        },
      }),
    ],
  }
}

export const providerFishAudioSpeech = defineProvider<FishAudioConfig, 'fish-audio-speech'>({
  id: 'fish-audio-speech',
  name: 'Fish Audio',
  nameLocalize: () => 'Fish Audio',
  description: 'fish.audio',
  descriptionLocalize: () => 'fish.audio',
  tasks: ['text-to-speech'],
  icon: 'i-lobe-icons:fishaudio',
  createProviderConfig: ({ t }) => fishAudioConfigSchema.extend({
    apiKey: fishAudioConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: 'Your Fish Audio API key, from fish.audio > API Keys.',
      placeholderLocalized: 'Fish Audio API key',
      type: 'password',
    }),
    baseUrl: fishAudioConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: FISH_AUDIO_COMPAT_BASE_URL,
    }),
  }),
  createProvider: createFishAudioSpeechProvider,
  validationRequiredWhen: config => Boolean(config.apiKey?.trim()),
  validators: createFishAudioValidators(),
  extraMethods: {
    listModels: async () => [
      { id: 'fish-audio/s2.1-pro', name: 'Fish Audio S2.1 Pro', provider: 'fish-audio-speech', description: 'Production model, billed per text size', contextLength: 0, deprecated: false },
      { id: 'fish-audio/s2.1-pro-free', name: 'Fish Audio S2.1 Pro (free)', provider: 'fish-audio-speech', description: 'Free model for testing before adding credit', contextLength: 0, deprecated: false },
    ],
    // Fish Audio has no voice listing through the compat endpoint. The voice ID is entered by hand.
    voiceCatalogConfig: () => ({}),
    listVoices: async () => [],
  },
})
