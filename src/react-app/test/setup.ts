import '@testing-library/jest-dom/vitest';

const matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: matchMedia });
