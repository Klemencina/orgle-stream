export type PurchaseCheck = {
  purchased: boolean | null
  status: 'checking' | 'pending' | 'error' | 'idle'
}

// One request at a time, with a bounded wait for delayed confirmation.
export function startPurchaseCheck(options: {
  concertId: string
  sessionId?: string | null
  returning: boolean
  onState: (state: PurchaseCheck) => void
  fetcher?: typeof fetch
}) {
  const controller = new AbortController()
  const fetcher = options.fetcher ?? fetch
  let timer: ReturnType<typeof setTimeout> | undefined
  let requestTimeout: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  const emit = (state: PurchaseCheck) => {
    if (!controller.signal.aborted) options.onState(state)
  }
  async function check() {
    attempt++
    const request = new AbortController()
    const abort = () => request.abort()
    controller.signal.addEventListener('abort', abort, { once: true })
    requestTimeout = setTimeout(abort, 10_000)
    let status: 'pending' | 'error' = 'error'
    let purchased: boolean | null = null
    try {
      const query = new URLSearchParams({ concertId: options.concertId })
      if (options.returning && options.sessionId) query.set('sessionId', options.sessionId)
      const response = await fetcher(`/api/purchase?${query}`, { cache: 'no-store', signal: request.signal })
      if (!response.ok) throw new Error('Purchase check failed')
      const data = await response.json()
      if (controller.signal.aborted) return
      if (data.mismatch || (options.returning && data.requiresAuth)) {
        emit({ purchased: null, status: 'error' })
        return
      }
      purchased = data.purchased === true ? true : null
      if (data.purchased === true && !data.checkoutPending) {
        emit({ purchased: true, status: 'idle' })
        return
      }
      if (typeof data.purchased !== 'boolean') throw new Error('Invalid purchase response')
      if (!options.returning) {
        emit({ purchased: false, status: 'idle' })
        return
      }
      status = 'pending'
      emit({ purchased, status: 'checking' })
    } catch {
      if (controller.signal.aborted) return
    } finally {
      clearTimeout(requestTimeout)
      controller.signal.removeEventListener('abort', abort)
    }
    if (options.returning && attempt < 6) {
      timer = setTimeout(() => void check(), attempt * 1000)
    } else {
      emit({ purchased, status })
    }
  }
  emit({ purchased: null, status: 'checking' })
  void check()
  return () => {
    controller.abort()
    clearTimeout(timer)
    clearTimeout(requestTimeout)
  }
}
