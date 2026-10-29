/** Audio format the voice service (onecx-pipecat) expects: PCM16, mono, 16 kHz. */
export const CAPTURE_SAMPLE_RATE = 16000

/** Samples per chunk sent to the voice service: 40 ms at 16 kHz. */
export const CAPTURE_CHUNK_SAMPLES = 640

export const CAPTURE_PROCESSOR_NAME = 'onecx-voice-pcm16-capture'

/**
 * AudioWorklet processor that turns the microphone into PCM16 mono chunks at
 * `targetSampleRate`. Every output sample is the average of the input samples it
 * covers (a box filter, which is enough for speech recognition). Full chunks are
 * posted to the main thread as transferable `ArrayBuffer`s.
 *
 * It is a string so it can be loaded from a Blob URL without shipping a separate asset.
 */
export const CAPTURE_WORKLET_SOURCE = `
class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const { targetSampleRate, chunkSamples } = options.processorOptions
    this.ratio = sampleRate / targetSampleRate
    this.chunkSamples = chunkSamples
    this.chunk = new Int16Array(chunkSamples)
    this.length = 0
    this.sum = 0
    this.count = 0
    this.phase = 0
    this.last = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i]
      this.count++
      this.phase++
      while (this.phase >= this.ratio) {
        this.phase -= this.ratio
        // Upsampling (ratio < 1) repeats the last value.
        const value = this.count > 0 ? this.sum / this.count : this.last
        this.last = value
        this.sum = 0
        this.count = 0
        const clamped = Math.max(-1, Math.min(1, value))
        this.chunk[this.length++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
        if (this.length === this.chunkSamples) {
          this.port.postMessage(this.chunk.buffer, [this.chunk.buffer])
          this.chunk = new Int16Array(this.chunkSamples)
          this.length = 0
        }
      }
    }
    return true
  }
}

registerProcessor('${CAPTURE_PROCESSOR_NAME}', Pcm16CaptureProcessor)
`

export function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary)
}

/** Decodes base64 little-endian PCM16; a trailing odd byte is dropped. */
export function decodePcm16(base64: string): Int16Array {
  const binary = atob(base64)
  const samples = new Int16Array(binary.length >> 1)
  for (let i = 0; ; i++) {
    const lowByte = binary.codePointAt(2 * i)
    const highByte = binary.codePointAt(2 * i + 1)
    // Ends after the last full pair, at i === samples.length.
    if (lowByte === undefined || highByte === undefined) {
      return samples
    }
    samples[i] = lowByte | (highByte << 8)
  }
}
