import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";

import type { FetchBytes } from "@uoplan/data/transport";

import { BUNDLED_DATA_MODULES, type BundledDataAssetModule } from "./bundled-data-assets";
import type { DataAssetManifest } from "./manifest";

declare const require: (id: string) => unknown;

interface ExpoAssetInstance {
  localUri: string | null;
  uri: string;
  downloadAsync(): Promise<ExpoAssetInstance>;
}

interface ExpoAssetModule {
  Asset: {
    fromModule(module: BundledDataAssetModule): ExpoAssetInstance;
  };
}

const BASE64_LOOKUP = new Map(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    .split("")
    .map((char, index) => [char, index] as const),
);

function expoAsset(): ExpoAssetModule["Asset"] {
  return (require("expo-asset") as ExpoAssetModule).Asset;
}

function bundledManifestFromDisk(): DataAssetManifest | null {
  try {
    const raw = require("../../assets/data/manifest.json");
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const manifest: DataAssetManifest = {};
    for (const [id, url] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof url === "string" && id in BUNDLED_DATA_MODULES) manifest[id] = url;
    }
    return manifest;
  } catch {
    return null;
  }
}

function createBundledManifest(): DataAssetManifest {
  const manifest = bundledManifestFromDisk() ?? {};
  for (const id of Object.keys(BUNDLED_DATA_MODULES)) {
    manifest[id] ??= `bundled://${id}`;
  }
  return manifest;
}

export const BUNDLED_DATA_MANIFEST: DataAssetManifest = createBundledManifest();

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, "");
  if (clean.length === 0) return new Uint8Array();
  if (clean.length % 4 !== 0) throw new Error("Invalid base64 data length");

  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let out = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_LOOKUP.get(clean[i]);
    const b = BASE64_LOOKUP.get(clean[i + 1]);
    const c = clean[i + 2] === "=" ? 0 : BASE64_LOOKUP.get(clean[i + 2]);
    const d = clean[i + 3] === "=" ? 0 : BASE64_LOOKUP.get(clean[i + 3]);
    if (a == null || b == null || c == null || d == null) {
      throw new Error("Invalid base64 data");
    }

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = (chunk >> 16) & 0xff;
    if (out < bytes.length) bytes[out++] = (chunk >> 8) & 0xff;
    if (out < bytes.length) bytes[out++] = chunk & 0xff;
  }

  return bytes;
}

export async function loadAssetModuleBytes(module: BundledDataAssetModule): Promise<Uint8Array> {
  const asset = expoAsset().fromModule(module);
  const downloaded = await asset.downloadAsync();
  const uri = downloaded.localUri ?? asset.localUri ?? downloaded.uri ?? asset.uri;
  if (!uri) throw new Error("Bundled data asset did not resolve to a local URI");
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return base64ToBytes(base64);
}

export function hasBundledDataAsset(id: string): boolean {
  return id in BUNDLED_DATA_MODULES;
}

export async function loadBundledDataBytes(id: string): Promise<Uint8Array | null> {
  const module = BUNDLED_DATA_MODULES[id as keyof typeof BUNDLED_DATA_MODULES];
  return module ? loadAssetModuleBytes(module) : null;
}

export function createBundledDataTransport(): FetchBytes {
  return async (id) => {
    const bytes = await loadBundledDataBytes(id);
    if (bytes === null) throw new Error(`Bundled data asset is not available: ${id}`);
    return bytes;
  };
}
