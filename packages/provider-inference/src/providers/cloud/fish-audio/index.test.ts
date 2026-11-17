import { generateSpeech } from '@xsai/generate-speech'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FISH_AUDIO_COMPAT_BASE_URL, providerFishAudioSpeech, toFishAudioBody } from '.'

describe('fish audio speech provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps only the fields that Fish Audio accepts and asks for mp3', () => {
    const body = toFishAudioBody({
      model: 'fish-audio/s2.1-pro',
      input: 'Bonjour',
      voice: 'abc123',
      base_url: 'https://example.com/',
      voice_settings: { speed: 1 },
      instructions: 'cheerful',
      speed: 1,
    }, {})
    expect(body).toEqual({ model: 'fish-audio/s2.1-pro', input: 'Bonjour', voice: 'abc123', response_format: 'mp3' })
  })

  it('sends speed only when it differs from 1', () => {
    expect(toFishAudioBody({ input: 'a', voice: 'v', speed: 1.2 }, {}).speed).toBe(1.2)
    expect(toFishAudioBody({ input: 'a', voice: 'v' }, { speed: 1 }).speed).toBeUndefined()
  })

  it('posts to the compat endpoint with the bearer key, through generateSpeech', async () => {
    const calls: Array<{ url: string, init: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
    }))

    const provider = await providerFishAudioSpeech.createProvider({ apiKey: ' key ', baseUrl: '', model: '', voice: 'shinobu' }) as any
    const audio = await generateSpeech({
      ...provider.speech('fish-audio/s2.1-pro', { apiKey: 'key', baseUrl: 'x', voiceSettings: { speed: 1 } }),
      input: 'Okay, je vais regarder ça.',
      voice: 'c2536221a1c141ceae2d11fe15503858',
    })

    expect(new Uint8Array(audio)).toEqual(new Uint8Array([1, 2, 3]))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${FISH_AUDIO_COMPAT_BASE_URL}audio/speech`)
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer key')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      model: 'fish-audio/s2.1-pro',
      input: 'Okay, je vais regarder ça.',
      voice: 'c2536221a1c141ceae2d11fe15503858',
      response_format: 'mp3',
    })
  })

  it('reports the Fish Audio error instead of returning it as audio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"Invalid voice"}', { status: 400, statusText: 'Bad Request' })))
    const provider = await providerFishAudioSpeech.createProvider({ apiKey: 'key' }) as any
    await expect(generateSpeech({ ...provider.speech('fish-audio/s2.1-pro'), input: 'a', voice: 'bad' })).rejects.toThrow(/400 Bad Request - .*Invalid voice/)
  })

  it('lists both Fish Audio models and no voices', async () => {
    const extra = providerFishAudioSpeech.extraMethods as any
    expect((await extra.listModels({})).map((model: { id: string }) => model.id)).toEqual(['fish-audio/s2.1-pro', 'fish-audio/s2.1-pro-free'])
    expect(await extra.listVoices({})).toEqual([])
  })
})
