import { jest } from '@jest/globals'
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone'

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
})

/* fixes a bug with jsdom: ignoring this error message in log */
const originalConsoleError = console.error
console.error = (message, ...optionalParams) => {
  try {
    if (message && message.indexOf('Error: Could not parse CSS stylesheet') > -1) return
  } catch (err) {
    return
  }
  originalConsoleError(message, ...optionalParams)
}

/* Mock matchMedia for tests */
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})
