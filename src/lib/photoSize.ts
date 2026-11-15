export type PhotoSize = 'normal' | 'large' | 'xlarge'

export const PHOTO_SIZES: { id: PhotoSize; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
]

export const PHOTO_SIZE_STORAGE_KEY = 'picaloco-photo-size'

export function parsePhotoSize(raw: unknown): PhotoSize {
  return raw === 'large' || raw === 'xlarge' ? raw : 'normal'
}

export const GRID_COLUMNS: Record<PhotoSize, string> = {
  normal: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  xlarge: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}

export const TILE_LABEL: Record<PhotoSize, string> = {
  normal: 'text-sm',
  large: 'text-lg',
  xlarge: 'text-2xl',
}

// The review photo's height. Normal fits the whole card in the window with no scrolling: the rest of
// the page takes about 44rem (header, filters, Back/Next, description, boxes). Large and Extra large
// give the photo more room, so the boxes below it may need a short scroll.
export const REVIEW_PHOTO_HEIGHT: Record<PhotoSize, string> = {
  normal: 'h-[clamp(14rem,calc(100dvh-44rem),48rem)]',
  large: 'h-[clamp(20rem,calc(100dvh-28rem),64rem)]',
  xlarge: 'h-[clamp(26rem,calc(100dvh-14rem),80rem)]',
}
