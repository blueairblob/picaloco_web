import { afterEach, describe, expect, it, vi } from 'vitest'
// The thin Vercel wrapper. Its test lives here: every file under api/ deploys as a function.
import handler from '../api/volunteers.js'

afterEach(() => vi.unstubAllGlobals())

function response() {
  const sent: { status?: number; body?: unknown } = {}
  return {
    sent,
    res: {
      setHeader: () => {},
      status: (code: number) => {
        sent.status = code
        return { json: (body: unknown) => void (sent.body = body), end: () => {} }
      },
    },
  }
}

describe('POST /api/volunteers', () => {
  it('answers 400 when the JSON body is malformed (Vercel throws reading req.body)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
      get body(): unknown {
        throw new SyntaxError('Unexpected token')
      },
    }
    const { sent, res } = response()
    await handler(req, res)
    expect(sent).toEqual({ status: 400, body: { error: 'bad request' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
