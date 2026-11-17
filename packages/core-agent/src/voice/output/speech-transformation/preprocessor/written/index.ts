import type { SpeechPreprocessor } from '../types'

/**
 * A block that the chat shows but the voice does not read, for example a long translation or a detailed answer.
 * The character prompt tells the model to wrap such content in `<written>` and `</written>`, and to say a short line
 * outside it. A block that the model has not closed yet hides the rest of the text.
 */
export const writtenBlock = /<written>[\s\S]*?(?:<\/written>|$)/g

/** Removes `<written>` blocks before the markdown is parsed, so their text is never spoken. */
export function writtenSpeechPreprocessor(): SpeechPreprocessor {
  return {
    name: 'written',
    prepare: markdown => markdown.replace(writtenBlock, ''),
  }
}

/**
 * Moves a segment end out of a `<written>` block, so a block is never split between two segments.
 * Returns the start of the block when `end` falls inside one, else `end`.
 */
export function endOutsideWritten(text: string, end: number): number {
  for (const match of text.matchAll(writtenBlock)) {
    const start = match.index!
    const stop = start + match[0].length
    const closed = match[0].endsWith('</written>')
    if (end > start && (end < stop || !closed))
      return start
  }
  return end
}
