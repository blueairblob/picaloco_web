const IMAGES_BASE_URL = import.meta.env.VITE_IMAGES_BASE_URL

export function getThumbnailUrl(imageNo: string): string {
  const normalized = imageNo.replace(/\s/g, '')
  return `${IMAGES_BASE_URL}/${normalized}.webp`
}

// Only 320px thumbnails exist in Storage today; switch to a full-size URL once those are uploaded.
export function getReviewImageUrl(imageNo: string): string {
  return getThumbnailUrl(imageNo)
}
