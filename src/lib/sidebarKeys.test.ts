import { describe, expect, it } from 'vitest'
import { shouldToggleSidebar } from './sidebarKeys'

const button = { tagName: 'BUTTON', isContentEditable: false }
const press = (over: Partial<Parameters<typeof shouldToggleSidebar>[0]> = {}) =>
  shouldToggleSidebar({ key: 'b', ctrlKey: true, metaKey: false, target: button, modalOpen: false, ...over })

describe('shouldToggleSidebar', () => {
  it('toggles on Ctrl+B or Cmd+B from a button, a link or the page', () => {
    expect(press()).toBe(true)
    expect(press({ ctrlKey: false, metaKey: true })).toBe(true)
    expect(press({ target: { tagName: 'A', isContentEditable: false } })).toBe(true)
    expect(press({ target: null })).toBe(true)
  })
  it('ignores B without Ctrl or Cmd, and other keys', () => {
    expect(press({ ctrlKey: false })).toBe(false)
    expect(press({ key: 'c' })).toBe(false)
  })
  it('leaves text boxes their own Ctrl/Cmd+B', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(press({ target: { tagName, isContentEditable: false } })).toBe(false)
    }
    expect(press({ target: { tagName: 'DIV', isContentEditable: true } })).toBe(false)
  })
  it('does nothing while a modal such as Settings is open', () => {
    expect(press({ modalOpen: true })).toBe(false)
  })
})
