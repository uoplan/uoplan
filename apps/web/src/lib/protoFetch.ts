import { dataClient } from "./dataClient";
import { optional } from "@uoplan/data";
import type { ProtoDecoder } from "@uoplan/data";

/**
 * Fetch raw `.pb` bytes through the shared browser data client, by asset id
 * (bare filename, e.g. `terms.pb`). Results are memoized per id; a rejected
 * fetch is evicted so a transient failure can be retried.
 */
export function fetchProtoBytes(id: string): Promise<Uint8Array> {
  return dataClient.fetchBytes(id);
}

/** Fetch + decode an asset into a proto message, memoizing the decoded result. */
export function loadProto<T>(type: ProtoDecoder<T>, id: string): Promise<T> {
  return dataClient.load(type, id);
}

/** Like {@link fetchProtoBytes} but resolves to `null` when the asset is missing. */
export function optionalProtoBytes(id: string): Promise<Uint8Array | null> {
  return optional(dataClient.fetchBytes, id);
}
