import { describe, expect, it } from 'vitest'
import { parseTextSize } from './textSize'

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
