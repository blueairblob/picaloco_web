export interface HighlightPart {
  text: string
  match: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Splits text into plain and matched parts (case-insensitive); longest terms win on overlap.
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (cleaned.length === 0 || !text) return text ? [{ text, match: false }] : []
  const re = new RegExp(`(${cleaned.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((p) => p.text !== '')
}
