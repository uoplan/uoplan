type DeepLinkMapping = {
  redirect: string;
  openExternal?: string;
};

type NativeIntentModule = {
  mapDeepLinkPath: (path: string) => DeepLinkMapping;
};

function loadNativeIntentModule(): NativeIntentModule | null {
  try {
    return require("@/app/+native-intent") as NativeIntentModule;
  } catch {
    return null;
  }
}

function mapDeepLinkPath(path: string): DeepLinkMapping | undefined {
  return loadNativeIntentModule()?.mapDeepLinkPath(path);
}

describe("mapDeepLinkPath", () => {
  it("redirects top-level changelog links to the native More changelog screen", () => {
    expect(mapDeepLinkPath("/changelog")).toEqual({ redirect: "/more/changelog" });
    expect(mapDeepLinkPath("/changelog/")).toEqual({ redirect: "/more/changelog" });
    expect(mapDeepLinkPath("/changelog?from=web")).toEqual({ redirect: "/more/changelog" });
    expect(mapDeepLinkPath("uoplan:///changelog")).toEqual({ redirect: "/more/changelog" });
  });

  it("opens graph links on the canonical web page and resolves in app to home", () => {
    expect(mapDeepLinkPath("/graph")).toEqual({
      redirect: "/",
      openExternal: "https://uoplan.party/graph",
    });
    expect(mapDeepLinkPath("/graph/?source=app")).toEqual({
      redirect: "/",
      openExternal: "https://uoplan.party/graph",
    });
  });

  it("passes already-matched native routes through unchanged", () => {
    for (const path of ["/", "/explore", "/donate", "/schedule", "/personalize", "/trends"]) {
      expect(mapDeepLinkPath(path)).toEqual({ redirect: path });
    }
  });
});
