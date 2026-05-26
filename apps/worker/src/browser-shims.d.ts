// Minimal ambient declarations for browser globals used by @uoplan/schedule.
// Workers have neither window nor document at runtime; we type them as `any`
// so that conditional guards and property access in the library source compile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const document: any;

// Workers expose crypto on globalThis; ESNext lib doesn't include this.
// oxlint-disable-next-line no-shadow-restricted-names
declare namespace globalThis {
  // eslint-disable-next-line no-var
  var crypto: Crypto;
}

interface Crypto {
  subtle: SubtleCrypto;
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
  randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
}

interface SubtleCrypto {
  digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  importKey(
    format: string,
    keyData: JsonWebKey | ArrayBuffer | ArrayBufferView,
    algorithm: string | { name: string } | object,
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey>;
  deriveBits(algorithm: object, baseKey: CryptoKey, length: number): Promise<ArrayBuffer>;
  sign(
    algorithm: string | object,
    key: CryptoKey,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer>;
}

interface CryptoKey {
  readonly type: string;
  readonly extractable: boolean;
  readonly algorithm: object;
  readonly usages: readonly string[];
}

interface JsonWebKey {
  [key: string]: unknown;
}

// Vite ?url import — not used at runtime in the worker but needed for types.
declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const src: string;
  export default src;
}

type BufferSource = ArrayBuffer | ArrayBufferView;
