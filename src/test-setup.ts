import { jest } from '@jest/globals'
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone'

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
})

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
