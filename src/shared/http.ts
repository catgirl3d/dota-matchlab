export class RequestTimeoutError extends Error {
  constructor() {
    super('The request timed out');
    this.name = 'RequestTimeoutError';
  }
}

export class ResponseBodyTooLargeError extends Error {
  constructor() {
    super('The response body exceeds the allowed size');
    this.name = 'ResponseBodyTooLargeError';
  }
}

export async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    await response.body?.cancel();
    throw new ResponseBodyTooLargeError();
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new ResponseBodyTooLargeError();
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder().decode(bytes);
  } finally {
    reader.releaseLock();
  }
}
