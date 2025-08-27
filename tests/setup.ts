import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
  cmp: vi.fn()
} as any;

global.FileSystemDirectoryHandle = vi.fn() as any;
global.FileSystemFileHandle = vi.fn() as any;

global.Worker = vi.fn(() => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  terminate: vi.fn(),
  onmessage: vi.fn(),
  onerror: vi.fn()
})) as any;

global.ImageData = class ImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number
  ) {}
} as any;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    register: vi.fn(),
    ready: Promise.resolve({
      unregister: vi.fn(),
      active: null,
      installing: null,
      waiting: null
    })
  }
});