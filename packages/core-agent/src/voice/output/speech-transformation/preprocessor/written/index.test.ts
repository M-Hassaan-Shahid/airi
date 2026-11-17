import { describe, expect, it } from 'vitest'

import { toSpeechText } from '../..'
import { MarkdownSegmenter } from '../../segmenter'

describe('written blocks', () => {
  it('does not read a written block', () => {
    const reply = 'Okay, I translated it for you!\n\n<written>\n\nBonjour. Ceci est une longue traduction. Elle a plusieurs phrases.\n\n</written>'
    expect(toSpeechText(reply).trim()).toBe('Okay, I translated it for you!')
  })

  it('reads text after a written block', () => {
    expect(toSpeechText('Here it is. <written>Long text. More text.</written> Anything else?').replace(/\s+/g, ' ').trim()).toBe('Here it is. Anything else?')
  })

  it('keeps a streamed block in one segment', () => {
    const segmenter = new MarkdownSegmenter()
    const segments: string[] = []
    for (const piece of ['Okay, done! ', '<written>\n\nFirst sentence. ', 'Second sentence. ', 'Third.\n\n</written>', '\n\nAnything else? '])
      segments.push(...segmenter.push(piece))
    segments.push(...segmenter.end())
    const spoken = segments.map(segment => toSpeechText(segment)).join(' ')
    expect(spoken).not.toMatch(/sentence|Third/)
    expect(spoken).toMatch(/Okay, done!/)
    expect(spoken).toMatch(/Anything else\?/)
  })
})
