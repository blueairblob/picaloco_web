import { describe, expect, it } from 'vitest'
import { parseTextSize, textSizeFromEvent, TEXT_SIZE_EVENT } from './textSize'

describe('parseTextSize', () => {
  it('reads the stored size', () => {
    expect(parseTextSize('large')).toBe('large')
    expect(parseTextSize('normal')).toBe('normal')
  })

  it('falls back to normal', () => {
    expect(parseTextSize(null)).toBe('normal')
    expect(parseTextSize('huge')).toBe('normal')
  })
})

describe('textSizeFromEvent', () => {
  it('takes the size from the event, not from storage', () => {
    expect(textSizeFromEvent(new CustomEvent(TEXT_SIZE_EVENT, { detail: 'large' }))).toBe('large')
    expect(textSizeFromEvent(new Event(TEXT_SIZE_EVENT))).toBe('normal')
  })
})
