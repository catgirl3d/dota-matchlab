import '@testing-library/jest-dom/vitest';
import { render as testingLibraryRender, type RenderOptions } from '@testing-library/react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { I18nProvider } from '../lib/i18n';

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

function TestI18nProvider({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return testingLibraryRender(ui, { ...options, wrapper: TestI18nProvider });
}
