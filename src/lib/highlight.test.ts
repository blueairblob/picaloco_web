import { describe, expect, it } from 'vitest'
import { highlightParts } from './highlight'

describe('highlightParts', () => {
  it('marks terms case-insensitively', () => {
    expect(highlightParts('LMS 42616 at Crewe; 42616 again', ['42616', 'crewe'])).toEqual([
      { text: 'LMS ', match: false },
      { text: '42616', match: true },
      { text: ' at ', match: false },
      { text: 'Crewe', match: true },
      { text: '; ', match: false },
      { text: '42616', match: true },
      { text: ' again', match: false },
    ])
  })

  it('tolerates regex metacharacters and empty terms', () => {
    expect(highlightParts('No. 3 (Hunslet)', ['(Hunslet)', '', 'No.'])).toEqual([
      { text: 'No.', match: true },
      { text: ' 3 ', match: false },
      { text: '(Hunslet)', match: true },
    ])
    expect(highlightParts('plain', [])).toEqual([{ text: 'plain', match: false }])
  })
})
