const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

interface RequestOptions extends RequestInit {
  /**
   * Whether to parse the response body (JSON/text) before returning.
   * Defaults to true.
   */
  parse?: boolean;
}

export const apiFetch = async <T = any>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });
  const shouldParse = options.parse ?? true;
  if (!shouldParse) {
    // @ts-expect-error allow caller to handle
    return response as any;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (body as any)?.error || response.statusText;
    throw new Error(message);
  }

  return body as T;
};
