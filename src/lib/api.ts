/**
 * API utility functions
 */

/**
 * Get the base API URL
 * In production, uses VITE_API_URL environment variable
 * In development, uses relative path (proxy handles it)
 */
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || '';
};

/**
 * Build full API endpoint URL
 * @param path - API endpoint path (e.g., '/api/assistant/chat')
 * @returns Full URL with API base
 */
export const buildApiUrl = (path: string): string => {
  const base = getApiUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

/**
 * Default fetch options with credentials
 */
export const defaultFetchOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Fetch with API URL prefix
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Fetch response
 */
export const apiFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const url = buildApiUrl(path);
  return fetch(url, {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...(options?.headers || {}),
    },
  });
};
