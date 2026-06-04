const inFlightRequests = new Map<string, Promise<unknown>>();

export function dedupeRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const request = factory().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, request);
  return request;
}
