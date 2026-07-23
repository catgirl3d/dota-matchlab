import { describe, expect, it, vi } from 'vitest';
import {
  RequestTimeoutError,
  ResponseBodyTooLargeError,
  readBoundedText,
  withTimeout,
} from './http';

describe('shared HTTP transport', () => {
  it('cancels a streamed response when it exceeds its byte limit', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('1234'));
      },
      cancel,
    }));

    await expect(readBoundedText(response, 6)).rejects.toBeInstanceOf(ResponseBodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('maps an operation abort caused by its timeout to RequestTimeoutError', async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(100, (signal) => new Promise<string>((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }));
      const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

