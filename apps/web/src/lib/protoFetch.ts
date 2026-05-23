const cache = new Map<string, Promise<Uint8Array>>();

export function fetchProtoBytes(path: string): Promise<Uint8Array> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load ${path}`);
      return new Uint8Array(await res.arrayBuffer());
    });
    cache.set(path, p);
  }
  return p;
}
