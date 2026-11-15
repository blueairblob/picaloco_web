import { useState } from 'react'
import { PHOTO_SIZE_STORAGE_KEY, parsePhotoSize, type PhotoSize } from '@/lib/photoSize'

function readStored(): PhotoSize {
  try {
    return parsePhotoSize(localStorage.getItem(PHOTO_SIZE_STORAGE_KEY))
  } catch {
    return 'normal' // localStorage unavailable
  }
}

export function usePhotoSize(): [PhotoSize, (s: PhotoSize) => void] {
  const [size, setSizeState] = useState<PhotoSize>(readStored)
  const setSize = (next: PhotoSize) => {
    setSizeState(next)
    try {
      localStorage.setItem(PHOTO_SIZE_STORAGE_KEY, next)
    } catch {
      // not remembered; still applies for this visit
    }
  }
  return [size, setSize]
}
