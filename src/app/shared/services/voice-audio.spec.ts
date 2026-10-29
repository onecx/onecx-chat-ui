import { CAPTURE_PROCESSOR_NAME, CAPTURE_WORKLET_SOURCE, decodePcm16, encodeBase64 } from './voice-audio'

interface CaptureProcessor {
  port: { postMessage: jest.Mock }
  process(inputs: Float32Array[][]): boolean
}

/** Runs the worklet source in a fake AudioWorkletGlobalScope and creates its processor. */
function createProcessor(sampleRate: number, chunkSamples: number): CaptureProcessor {
  class FakeAudioWorkletProcessor {
    port = { postMessage: jest.fn() }
  }
  const registerProcessor = jest.fn()
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', CAPTURE_WORKLET_SOURCE)(
    FakeAudioWorkletProcessor,
    registerProcessor,
    sampleRate
  )
  expect(registerProcessor).toHaveBeenCalledWith(CAPTURE_PROCESSOR_NAME, expect.any(Function))
  const Processor = registerProcessor.mock.calls[0][1]
  return new Processor({ processorOptions: { targetSampleRate: 16000, chunkSamples } })
}

function postedChunks(processor: CaptureProcessor): number[][] {
  return processor.port.postMessage.mock.calls.map(([buffer, transfer]) => {
    expect(transfer).toEqual([buffer])
    return Array.from(new Int16Array(buffer))
  })
}

describe('voice audio', () => {
  describe('capture worklet', () => {
    it('should average 48 kHz input down to 16 kHz and post full chunks only', () => {
      const processor = createProcessor(48000, 4)

      expect(processor.process([[new Float32Array([0.25, 0.5, 0.75, -0.25, -0.5, -0.75])]])).toBe(true)
      expect(processor.port.postMessage).not.toHaveBeenCalled()
      processor.process([[new Float32Array([0, 0, 0, 1, 1, 1, 0.5])]])

      expect(postedChunks(processor)).toEqual([[16383, -16384, 0, 32767]])
    })

    it('should repeat samples when the input rate is lower than 16 kHz', () => {
      const processor = createProcessor(8000, 4)

      processor.process([[new Float32Array([0.5, -0.5])]])

      expect(postedChunks(processor)).toEqual([[16383, 16383, -16384, -16384]])
    })

    it('should clamp samples outside of the valid range', () => {
      const processor = createProcessor(16000, 2)

      processor.process([[new Float32Array([1.5, -2])]])

      expect(postedChunks(processor)).toEqual([[32767, -32768]])
    })

    it('should keep running while the input has no channel', () => {
      const processor = createProcessor(16000, 2)

      expect(processor.process([])).toBe(true)
      expect(processor.process([[]])).toBe(true)
      expect(processor.port.postMessage).not.toHaveBeenCalled()
    })
  })

  describe('PCM16 encoding', () => {
    it('should encode an empty buffer', () => {
      expect(encodeBase64(new ArrayBuffer(0))).toBe('')
    })

    it.each(['', '\xff'])('should decode no samples when fewer than two bytes are supplied (%j)', (binary) => {
      expect(Array.from(decodePcm16(btoa(binary)))).toEqual([])
    })

    it('should round-trip samples through base64', () => {
      const samples = new Int16Array([0, 1, -1, 256, 32767, -32768])

      expect(Array.from(decodePcm16(encodeBase64(samples.buffer)))).toEqual([0, 1, -1, 256, 32767, -32768])
    })

    it('should decode little-endian samples and drop a trailing odd byte', () => {
      expect(Array.from(decodePcm16(btoa('\x01\x02\xff\xff\x03')))).toEqual([0x0201, -1])
    })
  })
})
