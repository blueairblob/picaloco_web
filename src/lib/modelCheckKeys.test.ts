import { describe, expect, it } from 'vitest'
import { checkShortcut } from './modelCheckKeys'

const answers = [
  { key: '1', id: 'steam', label: 'Steam' },
  { key: '5', id: 'tram', label: 'Tram' },
  { key: '0', id: 'other', label: 'Other' },
]
const body = { tagName: 'BODY', isContentEditable: false }

describe('checkShortcut', () => {
  it('picks by key', () => {
    expect(checkShortcut('5', body, answers)).toEqual({ type: 'pick', answerId: 'tram' })
    expect(checkShortcut('0', body, answers)).toEqual({ type: 'pick', answerId: 'other' })
  })
  it('ignores a digit with no answer', () => {
    expect(checkShortcut('7', body, answers)).toBeNull()
  })
  it('maps actions', () => {
    expect(checkShortcut('Enter', body, answers)).toEqual({ type: 'save' })
    expect(checkShortcut('s', body, answers)).toEqual({ type: 'skip' })
    expect(checkShortcut('ArrowRight', body, answers)).toEqual({ type: 'skip' })
    expect(checkShortcut('ArrowLeft', body, answers)).toEqual({ type: 'back' })
  })
  it('does nothing while typing', () => {
    const input = { tagName: 'INPUT', isContentEditable: false }
    expect(checkShortcut('5', input, answers)).toBeNull()
    expect(checkShortcut('Enter', input, answers)).toBeNull()
  })
})
