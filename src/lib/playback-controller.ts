import type Hls from 'hls.js'

export type PlaybackError = 'signIn' | 'purchaseRequired' | 'outsideWindow' | 'notFound' | 'notConfigured' | 'unsupported' | 'connection'
export type PlaybackState = { status: 'loading' | 'ready' | 'playing' | 'reconnecting' | 'error'; error?: PlaybackError }

export class PlaybackAccessError extends Error {
  constructor(public code: PlaybackError) { super(code) }
}

export function startPlayback(video: HTMLVideoElement, options: {
  getAccess: (signal: AbortSignal) => Promise<{ playbackUrl: string }>
  loadHls: () => Promise<typeof Hls>
  onState: (state: PlaybackState) => void
}) {
  let disposed = false
  let releasing = false
  let generation = 0
  let hls: Hls | null = null
  let request: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let wantsPlayback = true
  let status: PlaybackState['status'] = 'loading'

  function state(next: PlaybackState) {
    if (disposed) return
    status = next.status
    options.onState(next)
  }

  function clearStall() {
    clearTimeout(stallTimer)
    stallTimer = undefined
  }

  function clearTimers() {
    clearTimeout(retryTimer)
    clearStall()
    retryTimer = undefined
    stallTimer = undefined
  }

  function release() {
    releasing = true
    try {
      request?.abort()
      request = null
      hls?.destroy()
      hls = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    } finally {
      releasing = false
    }
  }

  function reconnect() {
    if (disposed || releasing || retryTimer || status === 'error') return
    clearStall()
    generation++
    state({ status: 'reconnecting' })
    release()
    if (attempts >= 5) {
      state({ status: 'error', error: 'connection' })
      return
    }
    const delay = Math.min(2000 * 2 ** attempts++, 15000)
    retryTimer = setTimeout(() => { retryTimer = undefined; void setup() }, delay)
  }

  function watchForStall() {
    if (!stallTimer) stallTimer = setTimeout(reconnect, 20000)
  }

  async function play() {
    wantsPlayback = true
    const current = generation
    try {
      await video.play()
    } catch (error) {
      if (disposed || current !== generation) return
      if (error instanceof Error && error.name === 'NotAllowedError') {
        clearStall()
        state({ status: 'ready' })
      } else if (!(error instanceof Error && error.name === 'AbortError')) {
        reconnect()
      }
    }
  }

  async function setup() {
    if (disposed) return
    const current = ++generation
    clearTimers()
    state({ status: attempts ? 'reconnecting' : 'loading' })
    release()
    request = new AbortController()
    watchForStall()
    try {
      const { playbackUrl } = await options.getAccess(request.signal)
      if (disposed || current !== generation) return
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playbackUrl
        video.load()
      } else {
        const Hls = await options.loadHls()
        if (disposed || current !== generation) return
        if (!Hls.isSupported()) throw new PlaybackAccessError('unsupported')
        const instance = new Hls({ enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60 })
        hls = instance
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!disposed && current === generation && data.fatal) reconnect()
        })
        instance.attachMedia(video)
        instance.loadSource(playbackUrl)
      }
    } catch (error) {
      if (disposed || current !== generation) return
      if (error instanceof PlaybackAccessError) {
        clearTimers()
        state({ status: 'error', error: error.code })
        release()
      } else {
        reconnect()
      }
    }
  }

  const onReady = () => {
    if (disposed || releasing || retryTimer || status === 'error') return
    clearStall()
    state({ status: video.paused ? 'ready' : 'playing' })
    if (wantsPlayback && video.paused) void play()
  }
  const onPlaying = () => {
    if (disposed || releasing || retryTimer || status === 'error') return
    clearTimers()
    attempts = 0
    wantsPlayback = true
    state({ status: 'playing' })
  }
  const onPause = () => {
    if (status === 'playing') {
      wantsPlayback = false
      clearStall()
      state({ status: 'ready' })
    }
  }
  const onWaiting = () => {
    if (!disposed && !releasing && wantsPlayback && !retryTimer && status !== 'error') watchForStall()
  }
  const onEnded = () => { if (wantsPlayback) reconnect() }
  const onError = () => { if (video.error) reconnect() }
  video.addEventListener('canplay', onReady)
  video.addEventListener('playing', onPlaying)
  video.addEventListener('pause', onPause)
  video.addEventListener('waiting', onWaiting)
  video.addEventListener('stalled', onWaiting)
  video.addEventListener('error', onError)
  video.addEventListener('ended', onEnded)
  void setup()

  return {
    play,
    retry() { attempts = 0; wantsPlayback = true; void setup() },
    dispose() {
      disposed = true
      generation++
      clearTimers()
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('stalled', onWaiting)
      video.removeEventListener('error', onError)
      video.removeEventListener('ended', onEnded)
      release()
    },
  }
}
