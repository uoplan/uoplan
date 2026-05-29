import { dataClient } from "./dataClient";

/**
 * Fetch raw `.pb` bytes through the shared browser data client. Results are
 * memoized per path; a rejected fetch is evicted so a transient failure can be
 * retried.
 */
export function fetchProtoBytes(path: string): Promise<Uint8Array> {
  return dataClient.fetchBytes(path);
}
