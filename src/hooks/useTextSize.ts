import { useEffect, useState } from 'react'
import { parseTextSize, TEXT_SIZE_EVENT, TEXT_SIZE_KEY, textSizeFromEvent, type TextSize } from '@/lib/textSize'

function readStored(): TextSize {
  try {
    return parseTextSize(localStorage.getItem(TEXT_SIZE_KEY))
  } catch {
    return 'normal' // localStorage unavailable (private browsing, etc.)
  }
}

export function useTextSize() {
  const [textSize, setTextSizeState] = useState<TextSize>(readStored)

  useEffect(() => {
    document.documentElement.classList.toggle('text-large', textSize === 'large')
  }, [textSize])

  // Another component's change (the menu) reaches App's copy through this event.
  useEffect(() => {
    const onChange = (e: Event) => setTextSizeState(textSizeFromEvent(e))
    window.addEventListener(TEXT_SIZE_EVENT, onChange)
    return () => window.removeEventListener(TEXT_SIZE_EVENT, onChange)
  }, [])

  const setTextSize = (next: TextSize) => {
    setTextSizeState(next)
    try {
      localStorage.setItem(TEXT_SIZE_KEY, next)
    } catch {
      // not remembered, still applied for this visit
    }
    window.dispatchEvent(new CustomEvent(TEXT_SIZE_EVENT, { detail: next }))
  }

  return { textSize, setTextSize }
}
