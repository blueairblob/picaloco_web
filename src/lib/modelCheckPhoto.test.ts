import { describe, expect, it } from 'vitest'
import { parseCheckImage, photoCheckLink, photoMode } from './modelCheckPhoto'

describe('photoMode', () => {
  it('stays blind when the photo was last answered in the random sample', () => {
    expect(photoMode({ checked_mode: 'sample', model_p: null }, 0.9)).toBe('sample')
  })
  it('is sure or unsure by the shown prediction', () => {
    expect(photoMode({ checked_mode: 'sure', model_p: 0.95 }, 0.9)).toBe('sure')
    expect(photoMode({ checked_mode: 'sure', model_p: 0.9 }, 0.9)).toBe('sure')
    expect(photoMode({ checked_mode: 'unsure', model_p: 0.5 }, 0.9)).toBe('unsure')
  })
  it('is unsure with no prediction or no earlier answer', () => {
    expect(photoMode({ checked_mode: 'sure', model_p: null }, 0.9)).toBe('unsure')
    expect(photoMode({ checked_mode: null, model_p: 0.95 }, 0.9)).toBe('sure')
  })
})

describe('photoCheckLink', () => {
  it('links one photo of a task, with the run', () => {
    expect(photoCheckLink('subject_type', 'aj011', 3)).toBe('/admin/model-check/subject_type?run=3&image=aj011')
  })
  it('leaves out a missing run and encodes odd ids', () => {
    expect(photoCheckLink('t x', 'Class 1400 (11)', null)).toBe('/admin/model-check/t%20x?image=Class+1400+%2811%29')
  })
})

describe('parseCheckImage', () => {
  it('reads the photo, or null', () => {
    expect(parseCheckImage(new URLSearchParams('image=aj011'))).toBe('aj011')
    expect(parseCheckImage(new URLSearchParams('image=%20'))).toBeNull()
    expect(parseCheckImage(new URLSearchParams(''))).toBeNull()
  })
  it('keeps inner spaces', () => {
    expect(parseCheckImage(new URLSearchParams('image=Class+1400+%2811%29'))).toBe('Class 1400 (11)')
  })
})
