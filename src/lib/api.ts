export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Network error', 'auth/network-request-failed', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data || {}) as { error?: string; code?: string };
    throw new ApiError(d.error || `Request failed (${res.status})`, d.code || `http/${res.status}`, res.status);
  }
  return data as T;
}
