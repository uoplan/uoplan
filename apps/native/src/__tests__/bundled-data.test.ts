jest.mock(
  "expo-asset",
  () => ({
    Asset: {
      fromModule: jest.fn(() => ({
        downloadAsync: jest.fn(async () => ({
          localUri: "file:///bundled/terms.pb",
        })),
      })),
    },
  }),
  { virtual: true },
);

jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: jest.fn(async () => "BAUG/w=="),
}));

import {
  base64ToBytes,
  createBundledDataTransport,
  hasBundledDataAsset,
  loadAssetModuleBytes,
  loadBundledDataBytes,
} from "@/data/bundled-data";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";

const { Asset } = require("expo-asset") as { Asset: { fromModule: jest.Mock } };

describe("bundled data assets", () => {
  it("decodes base64 file contents into protobuf bytes", () => {
    expect(base64ToBytes("AQID/w==")).toEqual(new Uint8Array([1, 2, 3, 255]));
  });

  it("loads an Expo asset module through localUri as base64 bytes", async () => {
    const bytes = await loadAssetModuleBytes(123);

    expect(Asset.fromModule).toHaveBeenCalledWith(123);
    expect(readAsStringAsync).toHaveBeenCalledWith("file:///bundled/terms.pb", {
      encoding: EncodingType.Base64,
    });
    expect(bytes).toEqual(new Uint8Array([4, 5, 6, 255]));
  });

  it("returns null for a missing bundled asset id", async () => {
    expect(hasBundledDataAsset("not-bundled.pb")).toBe(false);
    await expect(loadBundledDataBytes("not-bundled.pb")).resolves.toBeNull();
  });

  it("exposes bundled assets through a FetchBytes transport", async () => {
    expect(hasBundledDataAsset("terms.pb")).toBe(true);
    await expect(createBundledDataTransport()("terms.pb")).resolves.toEqual(
      new Uint8Array([4, 5, 6, 255]),
    );
  });
});
