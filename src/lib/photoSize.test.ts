import { describe, expect, it } from 'vitest'
import { GRID_COLUMNS, PHOTO_SIZES, MODEL_CHECK_PHOTO_HEIGHT, REVIEW_PHOTO_HEIGHT, TILE_LABEL, parsePhotoSize } from './photoSize'

describe('parsePhotoSize', () => {
  it('accepts valid sizes', () => {
    expect(parsePhotoSize('large')).toBe('large')
    expect(parsePhotoSize('xlarge')).toBe('xlarge')
  })
  it('falls back to normal', () => {
    expect(parsePhotoSize('huge')).toBe('normal')
    expect(parsePhotoSize(null)).toBe('normal')
    expect(parsePhotoSize(3)).toBe('normal')
  })
})

describe('photo size tables', () => {
  it('labels', () => {
    expect(PHOTO_SIZES.map((s) => s.label)).toEqual(['Normal', 'Large', 'Extra large'])
  })
  it('normal grid is the original layout; normal photo fits the window', () => {
    expect(GRID_COLUMNS.normal).toBe('grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')
    expect(REVIEW_PHOTO_HEIGHT.normal).toBe('h-[clamp(14rem,calc(100dvh-44rem),48rem)]')
  })
  it('every size has an entry in every table', () => {
    for (const { id } of PHOTO_SIZES) {
      expect(GRID_COLUMNS[id]).toBeTruthy()
      expect(TILE_LABEL[id]).toBeTruthy()
      expect(REVIEW_PHOTO_HEIGHT[id]).toBeTruthy()
    }
  })
})

describe('MODEL_CHECK_PHOTO_HEIGHT', () => {
  it('covers every size and gives Normal more room than the Data Fixes photo', () => {
    for (const { id } of PHOTO_SIZES) expect(MODEL_CHECK_PHOTO_HEIGHT[id]).toMatch(/^h-\[/)
    expect(MODEL_CHECK_PHOTO_HEIGHT.normal).not.toBe(REVIEW_PHOTO_HEIGHT.normal)
  })
})
