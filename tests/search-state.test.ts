import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppSettings, LocationPoint, MapProvider, SearchState } from "../src/types";
import { useSearchState } from "../src/hooks/useSearchState";
import { SettingsModal } from "../src/components/SettingsModal";

// --- Mock DOM Environment for React Client Tests in Bun ---

interface MockElement {
  nodeType: number;
  tagName: string;
  nodeName: string;
  ownerDocument: MockDoc;
  parentNode?: MockElement;
  childNodes: MockElement[];
  textContent?: string;
  value?: string;
  appendChild: (child: MockElement) => MockElement;
  removeChild: (child: MockElement) => MockElement;
  insertBefore: (child: MockElement, before: MockElement) => MockElement;
  addEventListener: (event: string, fn: unknown) => void;
  removeEventListener: (event: string, fn: unknown) => void;
  style: Record<string, unknown>;
  setAttribute: (k: string, v: unknown) => void;
  removeAttribute: (k: string) => void;
  [key: string]: unknown;
}

interface MockDoc {
  nodeType: number;
  nodeName: string;
  defaultView: WindowMock;
  createElement: (tag: string) => MockElement;
  createElementNS: (ns: string, tag: string) => MockElement;
  createTextNode: (text: string) => {
    nodeType: number;
    textContent: string;
    nodeName: string;
    childNodes: MockElement[];
    ownerDocument: MockDoc;
  };
  addEventListener: () => void;
  removeEventListener: () => void;
}

interface StorageMock {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
}

interface WindowMock {
  HTMLIFrameElement: new () => object;
  HTMLInputElement: new () => object;
  HTMLTextAreaElement: new () => object;
  HTMLSelectElement: new () => object;
  HTMLElement: new () => object;
  Element: new () => object;
  Document: new () => object;
  DocumentFragment: new () => object;
  EventTarget: new () => object;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
  location: {
    search: string;
    pathname: string;
  };
  history: {
    replaceState: (state: unknown, title: string, url: string) => void;
  };
  localStorage: StorageMock;
  window?: WindowMock;
  self?: WindowMock;
  document?: MockDoc;
}

let mockLocalStorage: Record<string, string> = {};
let currentSearch = "";
let replacedUrl = "";

function createMockDoc(win: WindowMock): MockDoc {
  const doc: MockDoc = {
    nodeType: 9,
    nodeName: "#document",
    defaultView: win,
    createElement: (tag: string) => createMockElement(tag, doc),
    createElementNS: (_ns: string, tag: string) => createMockElement(tag, doc),
    createTextNode: (text: string) => ({
      nodeType: 3,
      textContent: text,
      nodeName: "#text",
      childNodes: [],
      ownerDocument: doc,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return doc;
}

function createMockElement(tag: string, doc: MockDoc): MockElement {
  const el: MockElement = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    nodeName: tag.toUpperCase(),
    ownerDocument: doc,
    childNodes: [],
    appendChild: (child: MockElement) => {
      child.parentNode = el;
      el.childNodes.push(child);
      return child;
    },
    removeChild: (child: MockElement) => {
      const idx = el.childNodes.indexOf(child);
      if (idx !== -1) el.childNodes.splice(idx, 1);
      return child;
    },
    insertBefore: (child: MockElement, before: MockElement) => {
      child.parentNode = el;
      const idx = el.childNodes.indexOf(before);
      if (idx !== -1) el.childNodes.splice(idx, 0, child);
      else el.childNodes.push(child);
      return child;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {},
    setAttribute: (k: string, v: unknown) => {
      el[k] = v;
    },
    removeAttribute: (k: string) => {
      delete el[k];
    },
  };
  return el;
}

function setupDOM(initialSearch: string = "") {
  mockLocalStorage = {};
  currentSearch = initialSearch;
  replacedUrl = "";

  const win: WindowMock = {
    HTMLIFrameElement: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    HTMLSelectElement: class {},
    HTMLElement: class {},
    Element: class {},
    Document: class {},
    DocumentFragment: class {},
    EventTarget: class {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    location: {
      get search() {
        return currentSearch;
      },
      set search(val: string) {
        currentSearch = val;
      },
      pathname: "/",
    },
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        replacedUrl = url;
        if (url.includes("?")) {
          currentSearch = "?" + url.split("?")[1];
        } else {
          currentSearch = "";
        }
      },
    },
    localStorage: {
      getItem(k: string) {
        return mockLocalStorage[k] ?? null;
      },
      setItem(k: string, v: string) {
        mockLocalStorage[k] = v;
      },
      removeItem(k: string) {
        delete mockLocalStorage[k];
      },
      clear() {
        mockLocalStorage = {};
      },
    },
  };
  win.window = win;
  win.self = win;

  const doc = createMockDoc(win);
  win.document = doc;

  const globalScope = globalThis as unknown as {
    window: WindowMock;
    document: MockDoc;
    localStorage: StorageMock;
    IS_REACT_ACT_ENVIRONMENT: boolean;
  } & WindowMock;

  globalScope.window = win;
  globalScope.document = doc;
  globalScope.localStorage = win.localStorage;
  globalScope.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(globalScope, win);

  return { doc, win };
}

async function renderHook<T>(useHook: () => T) {
  const globalDoc = (globalThis as unknown as { document?: MockDoc }).document;
  const doc = globalDoc || setupDOM().doc;
  const container = createMockElement("div", doc);
  const root = createRoot(container as unknown as Element);

  const result = { current: null as unknown as T };

  function TestHarness() {
    result.current = useHook();
    return null;
  }

  await act(async () => {
    root.render(React.createElement(TestHarness));
    await new Promise((r) => setTimeout(r, 0));
  });

  return {
    result,
    act: async (fn: () => Promise<void> | void) => {
      await act(async () => {
        await fn();
        await new Promise((r) => setTimeout(r, 0));
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
        await new Promise((r) => setTimeout(r, 0));
      });
    },
  };
}

function findElement(
  node: MockElement,
  predicate: (n: MockElement) => boolean
): MockElement | null {
  if (predicate(node)) return node;
  for (const child of node.childNodes || []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function findAllElements(
  node: MockElement,
  predicate: (n: MockElement) => boolean,
  results: MockElement[] = []
): MockElement[] {
  if (predicate(node)) results.push(node);
  for (const child of node.childNodes || []) {
    findAllElements(child, predicate, results);
  }
  return results;
}

interface ReactProps {
  value?: string;
  onClick?: () => void;
  onChange?: (e: { target: { value: string } }) => void;
  [key: string]: unknown;
}

function getReactProps(node: MockElement): ReactProps | undefined {
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  return key ? (node[key] as ReactProps) : undefined;
}

function collectTextContent(node: MockElement): string {
  let text = node.textContent || "";
  for (const child of node.childNodes || []) {
    text += collectTextContent(child);
  }
  return text;
}

// --- Test Suites ---

describe("Task 6: Types and Shared Interfaces", () => {
  it("exports valid TypeScript interfaces and types", () => {
    const point: LocationPoint = {
      address: "Bangkok Central",
      lat: 13.75,
      lng: 100.5,
    };
    expect(point.address).toBe("Bangkok Central");
    expect(point.lat).toBe(13.75);
    expect(point.lng).toBe(100.5);

    const osmProvider: MapProvider = "osm";
    const googleProvider: MapProvider = "google";
    expect(osmProvider).toBe("osm");
    expect(googleProvider).toBe("google");

    const settings: AppSettings = {
      googleMapsApiKey: "AIzaTestKey",
      activeProvider: "google",
    };
    expect(settings.googleMapsApiKey).toBe("AIzaTestKey");
    expect(settings.activeProvider).toBe("google");

    const state: SearchState = {
      pointA: point,
      pointB: null,
      query: "Starbucks",
      activePinMode: "A",
      branches: [],
      midpoint: { lat: 13.75, lng: 100.5 },
      totalDistanceAB: 10.5,
      isLoading: false,
      error: null,
      highlightedBranchId: null,
    };
    expect(state.pointA).toEqual(point);
    expect(state.activePinMode).toBe("A");
    expect(state.query).toBe("Starbucks");
  });
});

describe("Task 6: useSearchState Hook", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("initializes with default search and settings state", async () => {
    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.pointA).toBeNull();
    expect(result.current.state.pointB).toBeNull();
    expect(result.current.state.query).toBe("Starbucks");
    expect(result.current.state.activePinMode).toBeNull();
    expect(result.current.state.branches).toEqual([]);
    expect(result.current.state.midpoint).toBeNull();
    expect(result.current.state.totalDistanceAB).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.highlightedBranchId).toBeNull();

    expect(result.current.settings.googleMapsApiKey).toBe("");
    expect(result.current.settings.activeProvider).toBe("osm");

    await unmount();
  });

  it("updates pointA, pointB, query, activePinMode, and highlightedBranchId", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    const pointA: LocationPoint = { address: "Siam Paragon", lat: 13.746, lng: 100.534 };
    const pointB: LocationPoint = { address: "Iconsiam", lat: 13.726, lng: 100.51 };

    await actHook(() => {
      result.current.setPointA(pointA);
      result.current.setPointB(pointB);
      result.current.setQuery("Amazon Cafe");
      result.current.setActivePinMode("A");
      result.current.setHighlightedBranchId("branch-1");
    });

    expect(result.current.state.pointA).toEqual(pointA);
    expect(result.current.state.pointB).toEqual(pointB);
    expect(result.current.state.query).toBe("Amazon Cafe");
    expect(result.current.state.activePinMode).toBe("A");
    expect(result.current.state.highlightedBranchId).toBe("branch-1");

    // Resetting and toggling
    await actHook(() => {
      result.current.setActivePinMode(null);
      result.current.setHighlightedBranchId(null);
    });

    expect(result.current.state.activePinMode).toBeNull();
    expect(result.current.state.highlightedBranchId).toBeNull();

    await unmount();
  });

  it("swaps point A and point B correctly", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    const pointA: LocationPoint = { address: "Point A", lat: 13.74, lng: 100.53 };
    const pointB: LocationPoint = { address: "Point B", lat: 13.72, lng: 100.51 };

    await actHook(() => {
      result.current.setPointA(pointA);
      result.current.setPointB(pointB);
    });

    expect(result.current.state.pointA?.address).toBe("Point A");
    expect(result.current.state.pointB?.address).toBe("Point B");

    await actHook(() => {
      result.current.swapPoints();
    });

    expect(result.current.state.pointA?.address).toBe("Point B");
    expect(result.current.state.pointB?.address).toBe("Point A");

    await unmount();
  });

  it("saves settings and persists them to localStorage", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.saveSettings({
        googleMapsApiKey: "AIzaCustomKey123",
        activeProvider: "google",
      });
    });

    expect(result.current.settings.googleMapsApiKey).toBe("AIzaCustomKey123");
    expect(result.current.settings.activeProvider).toBe("google");
    expect(mockLocalStorage["halfway_google_maps_key"]).toBe("AIzaCustomKey123");
    expect(mockLocalStorage["halfway_active_provider"]).toBe("google");

    await unmount();
  });

  it("restores saved settings from localStorage on mount", async () => {
    mockLocalStorage["halfway_google_maps_key"] = "AIzaExistingKey";
    mockLocalStorage["halfway_active_provider"] = "google";

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.settings.googleMapsApiKey).toBe("AIzaExistingKey");
    expect(result.current.settings.activeProvider).toBe("google");

    await unmount();
  });

  it("falls back to osm provider if saved key is missing even if provider is google", async () => {
    mockLocalStorage["halfway_google_maps_key"] = "";
    mockLocalStorage["halfway_active_provider"] = "google";

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.settings.googleMapsApiKey).toBe("");
    expect(result.current.settings.activeProvider).toBe("osm");

    await unmount();
  });

  it("reads URL search parameters on initial mount", async () => {
    setupDOM(
      "?a_lat=13.7563&a_lng=100.5018&a_name=Siam%20Square&b_lat=13.7245&b_lng=100.5284&b_name=Silom%20Complex&q=Milk%20Tea"
    );

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.pointA).toEqual({
      lat: 13.7563,
      lng: 100.5018,
      address: "Siam Square",
    });
    expect(result.current.state.pointB).toEqual({
      lat: 13.7245,
      lng: 100.5284,
      address: "Silom Complex",
    });
    expect(result.current.state.query).toBe("Milk Tea");

    await unmount();
  });

  it("falls back to lat, lng string when URL params omit a_name or b_name", async () => {
    setupDOM("?a_lat=13.75&a_lng=100.5&b_lat=13.72&b_lng=100.52");

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.pointA?.address).toBe("13.75, 100.5");
    expect(result.current.state.pointB?.address).toBe("13.72, 100.52");

    await unmount();
  });

  it("ignores NaN coordinates when hydrating from URL params", async () => {
    setupDOM("?a_lat=invalid&a_lng=100.5&b_lat=13.72&b_lng=notanumber");

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.pointA).toBeNull();
    expect(result.current.state.pointB).toBeNull();

    await unmount();
  });

  it("executeSearch sets error if pointA, pointB, or query is missing", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    // Both points missing
    await actHook(async () => {
      await result.current.executeSearch();
    });
    expect(result.current.state.error).toBe(
      "Please provide Point A, Point B, and a target venue/brand name."
    );

    // Only pointA present
    await actHook(async () => {
      result.current.setPointA({ lat: 13.75, lng: 100.5, address: "Point A" });
      await result.current.executeSearch();
    });
    expect(result.current.state.error).toBe(
      "Please provide Point A, Point B, and a target venue/brand name."
    );

    // Empty query
    await actHook(async () => {
      result.current.setPointB({ lat: 13.72, lng: 100.52, address: "Point B" });
      result.current.setQuery("   ");
      await result.current.executeSearch();
    });
    expect(result.current.state.error).toBe(
      "Please provide Point A, Point B, and a target venue/brand name."
    );

    await unmount();
  });

  it("executeSearch executes POST request, updates state, and syncs URL params on success", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;

      return new Response(
        JSON.stringify({
          success: true,
          midpoint: { lat: 13.735, lng: 100.51 },
          totalDistanceAB: 5.2,
          branches: [
            {
              id: "b1",
              name: "Starbucks Midpoint",
              address: "Midway Road",
              lat: 13.734,
              lng: 100.512,
              distA: 2.6,
              distB: 2.7,
              distMid: 0.2,
              fairnessScore: 5.5,
              fairnessDelta: 0.1,
              tier: "primary",
              googleMapsUrl: "https://maps.google.com",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.setPointA({ lat: 13.75, lng: 100.5, address: "Siam" });
      result.current.setPointB({ lat: 13.72, lng: 100.52, address: "Silom" });
      result.current.setQuery("Starbucks");
      result.current.setActivePinMode("A");
    });

    await actHook(async () => {
      await result.current.executeSearch();
    });

    expect(capturedUrl).toBe("/api/search-midpoint");
    expect(capturedBody).toEqual({
      pointA: { lat: 13.75, lng: 100.5 },
      pointB: { lat: 13.72, lng: 100.52 },
      query: "Starbucks",
      apiKey: undefined,
      preferredProvider: "osm",
    });

    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.activePinMode).toBeNull();
    expect(result.current.state.branches.length).toBe(1);
    expect(result.current.state.branches[0].name).toBe("Starbucks Midpoint");
    expect(result.current.state.midpoint).toEqual({ lat: 13.735, lng: 100.51 });
    expect(result.current.state.totalDistanceAB).toBe(5.2);

    // Verify URL parameters updated
    expect(replacedUrl).toContain("a_lat=13.75");
    expect(replacedUrl).toContain("a_lng=100.5");
    expect(replacedUrl).toContain("a_name=Siam");
    expect(replacedUrl).toContain("b_lat=13.72");
    expect(replacedUrl).toContain("b_lng=100.52");
    expect(replacedUrl).toContain("b_name=Silom");
    expect(replacedUrl).toContain("q=Starbucks");

    await unmount();
  });

  it("executeSearch handles API error responses gracefully", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Overpass API rate limit exceeded",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.setPointA({ lat: 13.75, lng: 100.5, address: "A" });
      result.current.setPointB({ lat: 13.72, lng: 100.52, address: "B" });
      result.current.setQuery("Cafe");
    });

    await actHook(async () => {
      await result.current.executeSearch();
    });

    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBe("Overpass API rate limit exceeded");

    await unmount();
  });

  it("executeSearch handles network throw gracefully", async () => {
    globalThis.fetch = (async () => {
      throw new Error("Network connection dropped");
    }) as unknown as typeof fetch;

    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.setPointA({ lat: 13.75, lng: 100.5, address: "A" });
      result.current.setPointB({ lat: 13.72, lng: 100.52, address: "B" });
      result.current.setQuery("Cafe");
    });

    await actHook(async () => {
      await result.current.executeSearch();
    });

    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBe("Network connection dropped");

    await unmount();
  });
});

describe("Task 6: SettingsModal Component", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders nothing when isOpen is false", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        React.createElement(SettingsModal, {
          isOpen: false,
          onClose: () => {},
          settings: { googleMapsApiKey: "", activeProvider: "osm" },
          onSaveSettings: () => {},
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.childNodes.length).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders modal dialog and elements when isOpen is true", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose: () => {},
          settings: { googleMapsApiKey: "AIzaTestKey", activeProvider: "google" },
          onSaveSettings: () => {},
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.childNodes.length).toBeGreaterThan(0);
    const textContent = collectTextContent(container);
    expect(textContent).toContain("Map & API Settings");
    expect(textContent).toContain("OpenStreetMap (Free)");
    expect(textContent).toContain("Google Maps");
    expect(textContent).toContain("Save Changes");
    expect(textContent).toContain("Cancel");

    const inputNode = findElement(container, (n) => n.tagName === "INPUT");
    expect(inputNode).not.toBeNull();
    const inputProps = getReactProps(inputNode!);
    expect(inputProps?.value).toBe("AIzaTestKey");

    await act(async () => {
      root.unmount();
    });
  });

  it("triggers onSaveSettings and onClose when Save Changes is clicked", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    let savedSettings: AppSettings | null = null;
    let closed = false;

    await act(async () => {
      root.render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose: () => {
            closed = true;
          },
          settings: { googleMapsApiKey: "AIzaInitial", activeProvider: "osm" },
          onSaveSettings: (s) => {
            savedSettings = s;
          },
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Find and toggle Google Maps provider button
    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const googleButton = buttons.find((btn) => collectTextContent(btn).includes("Google Maps"));
    expect(googleButton).toBeDefined();

    await act(async () => {
      getReactProps(googleButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Find and click Save Changes button
    const saveButton = buttons.find((btn) => collectTextContent(btn).includes("Save Changes"));
    expect(saveButton).toBeDefined();

    await act(async () => {
      getReactProps(saveButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(savedSettings as AppSettings | null).toEqual({
      googleMapsApiKey: "AIzaInitial",
      activeProvider: "google",
    });
    expect(closed).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("triggers onClose without saving when Cancel is clicked", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    let savedSettings: AppSettings | null = null;
    let closed = false;

    await act(async () => {
      root.render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose: () => {
            closed = true;
          },
          settings: { googleMapsApiKey: "", activeProvider: "osm" },
          onSaveSettings: (s) => {
            savedSettings = s;
          },
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const cancelButton = buttons.find((btn) => collectTextContent(btn).includes("Cancel"));
    expect(cancelButton).toBeDefined();

    await act(async () => {
      getReactProps(cancelButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(closed).toBe(true);
    expect(savedSettings).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("tests key validation: handles empty key, valid key, and invalid key", async () => {
    let capturedUrl = "";

    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      if (capturedUrl.includes("AIzaValidKey")) {
        return new Response(
          JSON.stringify({
            success: true,
            results: [{ label: "Bangkok, Thailand", lat: 13.75, lng: 100.5 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            results: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }) as unknown as typeof fetch;

    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose: () => {},
          settings: { googleMapsApiKey: "", activeProvider: "osm" },
          onSaveSettings: () => {},
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const testKeyButton = buttons.find((btn) => collectTextContent(btn).includes("Test Key"));
    expect(testKeyButton).toBeDefined();

    const inputNode = findElement(container, (n) => n.tagName === "INPUT");
    expect(inputNode).not.toBeNull();

    // 1. Click Test Key with empty key -> error message
    await act(async () => {
      getReactProps(testKeyButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(collectTextContent(container)).toContain("Please enter an API key first.");

    // 2. Set valid key and test -> verified message
    await act(async () => {
      getReactProps(inputNode!)?.onChange?.({ target: { value: "AIzaValidKey" } });
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      getReactProps(testKeyButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(capturedUrl).toContain("/api/geocode?q=Bangkok&provider=google&key=AIzaValidKey");
    expect(collectTextContent(container)).toContain("Google Maps API Key is verified!");

    // 3. Set invalid key and test -> error message
    await act(async () => {
      getReactProps(inputNode!)?.onChange?.({ target: { value: "AIzaInvalidKey" } });
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      getReactProps(testKeyButton!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(collectTextContent(container)).toContain(
      "Key returned no geocoding results or lacks Places API access."
    );

    await act(async () => {
      root.unmount();
    });
  });
});
