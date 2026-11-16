// The reader's text size choice (Menu > Text size). Large scales every page's root font size.
export type TextSize = 'normal' | 'large'

export const TEXT_SIZE_KEY = 'picaloco-text-size'

export function parseTextSize(stored: string | null): TextSize {
  return stored === 'large' ? 'large' : 'normal'
}

// Sent when the size changes, so every useTextSize() copy follows. The size travels with the event:
// re-reading storage would undo the change whenever storage is unavailable.
export const TEXT_SIZE_EVENT = 'picaloco-text-size'

export function textSizeFromEvent(e: Event): TextSize {
  return parseTextSize(e instanceof CustomEvent && typeof e.detail === 'string' ? e.detail : null)
}
