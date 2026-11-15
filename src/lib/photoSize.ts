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

export const REVIEW_PHOTO_HEIGHT: Record<PhotoSize, string> = {
  normal: 'h-[min(60vh,32rem)]',
  large: 'h-[min(75vh,44rem)]',
  xlarge: 'h-[min(85vh,56rem)]',
}
