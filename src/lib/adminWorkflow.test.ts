import { describe, expect, it } from 'vitest'
import { ADMIN_STEPS, currentAdminStep } from './adminWorkflow'

describe('ADMIN_STEPS', () => {
  it('lists the admin pages in the order data flows through them', () => {
    expect(ADMIN_STEPS.map((s) => [s.label, s.hint, s.path])).toEqual([
      ['Migration status', 'data in from FileMaker', '/admin'],
      ['Data fixes', 'numbers & names from descriptions', '/admin/fixes'],
      ['Model check', "AI's photo guesses", '/admin/model-check'],
    ])
  })
})

describe('currentAdminStep', () => {
  it('finds the step for each overview page', () => {
    expect(currentAdminStep('/admin')).toBe(0)
    expect(currentAdminStep('/admin/')).toBe(0)
    expect(currentAdminStep('/admin/fixes')).toBe(1)
    expect(currentAdminStep('/admin/model-check')).toBe(2)
  })
  it('counts a page inside a step as that step', () => {
    expect(currentAdminStep('/admin/fixes/abc')).toBe(1)
    expect(currentAdminStep('/admin/model-check/7')).toBe(2)
  })
  it('is -1 outside the admin pages, and not fooled by look-alike paths', () => {
    expect(currentAdminStep('/')).toBe(-1)
    expect(currentAdminStep('/photo/arc00001')).toBe(-1)
    expect(currentAdminStep('/admin/fixesx')).toBe(-1)
    expect(currentAdminStep('/administrator')).toBe(-1)
  })
})
