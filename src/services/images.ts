const IMAGES_BASE_URL = import.meta.env.VITE_IMAGES_BASE_URL

export function getThumbnailUrl(imageNo: string): string {
  const normalized = imageNo.replace(/\s/g, '')
  return `${IMAGES_BASE_URL}/${normalized}.webp`
}
