// The reader's text size choice (Menu > Text size). Large scales every page's root font size.
export type TextSize = 'normal' | 'large'

export const TEXT_SIZE_KEY = 'picaloco-text-size'

export function parseTextSize(stored: string | null): TextSize {
  return stored === 'large' ? 'large' : 'normal'
}
