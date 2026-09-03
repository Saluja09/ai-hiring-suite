/**
 * Subscribe to a campaign's server-sent event stream.
 *
 * Backend route: GET {NEXT_PUBLIC_API_BASE_URL}/stream/{campaignId}
 * Returns an unsubscribe function that closes the underlying EventSource.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function subscribe(
  campaignId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvent: (data: any) => void,
): () => void {
  // Guard for SSR — EventSource only exists in the browser.
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const source = new EventSource(`${API_BASE_URL}/stream/${campaignId}`);

  source.onmessage = (event: MessageEvent) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      onEvent(event.data);
    }
  };

  return () => {
    source.close();
  };
}

export default subscribe;
