import { TestBed } from '@angular/core/testing'

import { VoiceService, Transcript } from './voice.service'

/**
 * Build a fake MediaStream whose tracks expose a spy-able `stop()` so the
 * service's cleanup path can be asserted against.
 */
function createFakeMediaStream(): { stream: MediaStream; stop: jest.Mock } {
  const stop = jest.fn()
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  return { stream, stop }
}

describe('VoiceService', () => {
  let service: VoiceService

  const defineMediaDevices = (impl: Partial<MediaDevices>): void => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: impl,
      configurable: true
    } as PropertyDescriptor)
  }

  beforeEach(() => {
    jest.useFakeTimers()
    TestBed.configureTestingModule({ providers: [VoiceService] })
    service = TestBed.inject(VoiceService)
  })

  afterEach(() => {
    service.cleanup()
    jest.useRealTimers()
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })

  it('should start with a disconnected, non-connecting, unmuted state', () => {
    expect(service.isConnecting()).toBe(false)
    expect(service.isConnected()).toBe(false)
    expect(service.isMuted()).toBe(false)
    expect(service.micStream()).toBeUndefined()
    expect(service.botStream()).toBeUndefined()
  })

  describe('start', () => {
    it('should be a no-op when already connected', async () => {
      service.isConnected.set(true)

      await service.start('chat-1')

      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(true)
    })

    it('should transition to connected after the simulated connection delay', async () => {
      defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(createFakeMediaStream().stream) })

      await service.start('chat-1')

      // Immediately after start: connecting, not yet connected.
      expect(service.isConnecting()).toBe(true)
      expect(service.isConnected()).toBe(false)

      await jest.advanceTimersByTimeAsync(600)

      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(true)
      expect(service.isMuted()).toBe(false)
    })

    it('should set the mic stream when the microphone is granted', async () => {
      const { stream } = createFakeMediaStream()
      defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(stream) })

      await service.start('chat-1')
      await jest.advanceTimersByTimeAsync(600)
      // Let the async acquireMic() promise settle.
      await jest.runAllTicks()

      expect(service.micStream()).toBe(stream)
    })

    it('should keep the waveform idle when microphone access is denied', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      defineMediaDevices({
        getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
      })

      await service.start('chat-1')
      await jest.advanceTimersByTimeAsync(600)
      await jest.runAllTicks()

      expect(service.micStream()).toBeUndefined()
      expect(warn).toHaveBeenCalled()
    })

    it('should keep the waveform idle when no media devices are available', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      delete (navigator as any).mediaDevices

      await service.start('chat-1')
      await jest.advanceTimersByTimeAsync(600)
      await jest.runAllTicks()

      // acquireMic() rejects (no getUserMedia) and is caught.
      expect(service.micStream()).toBeUndefined()
      expect(warn).toHaveBeenCalled()
    })
  })

  describe('toggleMute', () => {
    it('should flip the muted state on each call', () => {
      expect(service.isMuted()).toBe(false)

      service.toggleMute()
      expect(service.isMuted()).toBe(true)

      service.toggleMute()
      expect(service.isMuted()).toBe(false)
    })
  })

  describe('transcript exchange', () => {
    it('should stream the user transcript then finalize it, then stream the bot reply', async () => {
      const userEvents: Transcript[] = []
      const botEvents: Transcript[] = []
      service.userTranscript$.subscribe((t) => userEvents.push(t))
      service.botTranscript$.subscribe((t) => botEvents.push(t))

      defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(createFakeMediaStream().stream) })
      await service.start('chat-1')
      await jest.runAllTimersAsync()
      await jest.runAllTicks()

      // User transcript streams in and ends with a final event carrying the full text.
      expect(userEvents.length).toBeGreaterThan(1)
      expect(userEvents.every((t) => !t.isFinal)).toBe(false)
      const final = userEvents.find((t) => t.isFinal)
      expect(final).toBeDefined()
      expect(final?.text).toBe('This is a mock message to show the voice chat UI.')

      // Intermediate user events build up progressively.
      expect(userEvents[0].text.length).toBeLessThan(final?.text.length ?? 0)

      // Bot reply streams in as un-spoken sentences.
      expect(botEvents.length).toBeGreaterThan(0)
      expect(botEvents.every((t) => t.spoken === false)).toBe(true)
      expect(botEvents.map((t) => t.text).join(' ')).toContain('Once the voice backend is implemented')
    })
  })

  describe('cleanup', () => {
    it('should reset all state and flush an empty user transcript', () => {
      const flushed: Transcript[] = []
      service.userTranscript$.subscribe((t) => flushed.push(t))

      service.isConnected.set(true)
      service.isConnecting.set(true)
      service.isMuted.set(true)
      service.botStream.set(createFakeMediaStream().stream)

      service.cleanup()

      expect(service.isConnected()).toBe(false)
      expect(service.isConnecting()).toBe(false)
      expect(service.isMuted()).toBe(false)
      expect(service.botStream()).toBeUndefined()
      expect(flushed).toEqual([{ text: '', isFinal: false }])
    })

    it('should stop the microphone tracks it owns', () => {
      const { stream, stop } = createFakeMediaStream()
      defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(stream) })

      void service.start('chat-1')
      return jest
        .advanceTimersByTimeAsync(600)
        .then(() => jest.runAllTicks())
        .then(() => {
          expect(service.micStream()).toBe(stream)
          service.cleanup()
          expect(stop).toHaveBeenCalled()
          expect(service.micStream()).toBeUndefined()
        })
    })

    it('should not stop tracks it does not own', () => {
      const stop = jest.fn()
      service.micStream.set({ getTracks: () => [{ stop }] } as unknown as MediaStream)

      service.cleanup()

      expect(stop).not.toHaveBeenCalled()
      expect(service.micStream()).toBeUndefined()
    })

    it('should be invoked on ngOnDestroy', () => {
      const userEvents: Transcript[] = []
      service.userTranscript$.subscribe((t) => userEvents.push(t))

      service.ngOnDestroy()

      expect(service.isConnected()).toBe(false)
      expect(userEvents).toEqual([{ text: '', isFinal: false }])
    })
  })

  describe('microphone selection', () => {
    const STORAGE_KEY = 'onecx-chat-ui.voice.microphone'

    const createDeviceStream = (deviceId: string): { stream: MediaStream; stop: jest.Mock } => {
      const stop = jest.fn()
      const stream = { getTracks: () => [{ stop, getSettings: () => ({ deviceId }) }] } as unknown as MediaStream
      return { stream, stop }
    }

    const device = (deviceId: string, kind: MediaDeviceKind = 'audioinput', label = deviceId): MediaDeviceInfo =>
      ({ deviceId, kind, label, groupId: '' }) as MediaDeviceInfo

    const startAndSettle = async (): Promise<void> => {
      await service.start('chat-1')
      await jest.advanceTimersByTimeAsync(600)
      await jest.runAllTicks()
    }

    beforeEach(() => {
      localStorage.removeItem(STORAGE_KEY)
      service = new VoiceService()
    })

    afterEach(() => {
      localStorage.removeItem(STORAGE_KEY)
    })

    it('should list audio inputs once the microphone was acquired and ignore other devices', async () => {
      defineMediaDevices({
        getUserMedia: jest.fn().mockResolvedValue(createDeviceStream('a').stream),
        enumerateDevices: jest
          .fn()
          .mockResolvedValue([
            device('a'),
            device('b'),
            device('communications'),
            device('cam', 'videoinput'),
            device('out', 'audiooutput')
          ])
      })

      await startAndSettle()

      expect(service.audioInputs().map((d) => d.deviceId)).toEqual(['a', 'b'])
      expect(service.activeDeviceId()).toBe('a')
    })

    it('should request the remembered microphone', async () => {
      localStorage.setItem(STORAGE_KEY, 'b')
      const getUserMedia = jest.fn().mockResolvedValue(createDeviceStream('b').stream)
      defineMediaDevices({ getUserMedia })
      service = new VoiceService()

      await startAndSettle()

      expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'b' } } })
      expect(service.activeDeviceId()).toBe('b')
    })

    it('should fall back to the default microphone when the remembered one is gone', async () => {
      localStorage.setItem(STORAGE_KEY, 'gone')
      const fallback = createDeviceStream('default')
      const getUserMedia = jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }))
        .mockResolvedValueOnce(fallback.stream)
      defineMediaDevices({ getUserMedia })
      service = new VoiceService()

      await startAndSettle()

      expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true })
      expect(service.micStream()).toBe(fallback.stream)
      expect(service.selectedDeviceId()).toBeUndefined()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should replace the stream and remember the choice when a microphone is selected during voice chat', async () => {
      const first = createDeviceStream('a')
      const second = createDeviceStream('b')
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      defineMediaDevices({ getUserMedia })
      await startAndSettle()

      service.selectDevice('b')
      await jest.runAllTicks()
      await Promise.resolve()

      expect(first.stop).toHaveBeenCalled()
      expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { deviceId: { exact: 'b' } } })
      expect(service.micStream()).toBe(second.stream)
      expect(service.activeDeviceId()).toBe('b')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('b')
    })

    it('should only remember the choice when no voice chat is running', () => {
      const getUserMedia = jest.fn()
      defineMediaDevices({ getUserMedia })

      service.selectDevice('b')

      expect(getUserMedia).not.toHaveBeenCalled()
      expect(service.selectedDeviceId()).toBe('b')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('b')
    })

    it('should stop a stream that arrives after cleanup', async () => {
      const late = createDeviceStream('a')
      let resolveStream: (stream: MediaStream) => void = () => undefined
      defineMediaDevices({
        getUserMedia: jest.fn().mockReturnValue(new Promise((resolve) => (resolveStream = resolve)))
      })
      await service.start('chat-1')
      await jest.advanceTimersByTimeAsync(600)

      service.cleanup()
      resolveStream(late.stream)
      await jest.runAllTicks()
      await Promise.resolve()

      expect(late.stop).toHaveBeenCalled()
      expect(service.micStream()).toBeUndefined()
    })

    it('should re-acquire the default microphone when the active one is unplugged', async () => {
      const first = createDeviceStream('a')
      const second = createDeviceStream('b')
      const listeners: Array<() => void> = []
      const enumerateDevices = jest.fn().mockResolvedValueOnce([device('a'), device('b')])
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      defineMediaDevices({
        getUserMedia,
        enumerateDevices,
        addEventListener: ((_: string, listener: () => void) => listeners.push(listener)) as any,
        removeEventListener: jest.fn() as any
      })
      await startAndSettle()
      enumerateDevices.mockResolvedValue([device('b')])

      listeners[0]()
      await jest.runAllTicks()
      await Promise.resolve()
      await Promise.resolve()

      expect(first.stop).toHaveBeenCalled()
      expect(service.micStream()).toBe(second.stream)
    })
  })
})
