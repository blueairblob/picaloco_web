import { describe, expect, it } from 'vitest'
import { GRID_COLUMNS, PHOTO_SIZES, REVIEW_PHOTO_HEIGHT, TILE_LABEL, parsePhotoSize } from './photoSize'

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
  it('normal is exactly the current layout', () => {
    expect(GRID_COLUMNS.normal).toBe('grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')
    expect(REVIEW_PHOTO_HEIGHT.normal).toBe('h-[min(60vh,32rem)]')
  })
  it('every size has an entry in every table', () => {
    for (const { id } of PHOTO_SIZES) {
      expect(GRID_COLUMNS[id]).toBeTruthy()
      expect(TILE_LABEL[id]).toBeTruthy()
      expect(REVIEW_PHOTO_HEIGHT[id]).toBeTruthy()
    }
  })
})
