import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppSettings, LocationPoint, MapProvider, Person, SearchState } from "../src/types";
import { useSearchState, PERSON_COLORS } from "../src/hooks/useSearchState";
import { SettingsModal } from "../src/components/SettingsModal";
import { ShareModal } from "../src/components/ShareModal";

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
  navigator?: {
    clipboard: {
      writeText: (text: string) => Promise<void>;
    };
  };
  window?: WindowMock;
  self?: WindowMock;
  document?: MockDoc;
}

let mockLocalStorage: Record<string, string> = {};
let currentSearch = "";
let replacedUrl = "";
let writtenClipboardText = "";

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
  writtenClipboardText = "";

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
    navigator: {
      clipboard: {
        writeText: async (text: string) => {
          writtenClipboardText = text;
        },
      },
    },
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
    navigator?: {
      clipboard: {
        writeText: (text: string) => Promise<void>;
      };
    };
    IS_REACT_ACT_ENVIRONMENT: boolean;
  } & WindowMock;

  globalScope.window = win;
  globalScope.document = doc;
  globalScope.localStorage = win.localStorage;
  globalScope.navigator = win.navigator;
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

    const person: Person = {
      id: "person-1",
      name: "Person 1",
      address: "Bangkok Central",
      lat: 13.75,
      lng: 100.5,
      color: "#10b981",
    };
    expect(person.id).toBe("person-1");
    expect(person.name).toBe("Person 1");
    expect(person.color).toBe("#10b981");

    const state: SearchState = {
      persons: [person],
      activePinPersonId: "person-1",
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
    expect(state.persons).toEqual([person]);
    expect(state.activePinPersonId).toBe("person-1");
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
    expect(capturedBody).toMatchObject({
      query: "Starbucks",
      preferredProvider: "osm",
    });
    expect((capturedBody as any).persons).toBeDefined();
    expect((capturedBody as any).persons[0].lat).toBe(13.75);
    expect((capturedBody as any).persons[1].lat).toBe(13.72);

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

  it("displays server default key indicator when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaServerEnvKey";

    try {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(SettingsModal, {
            isOpen: true,
            onClose: () => {},
            settings: { googleMapsApiKey: "", activeProvider: "google" },
            onSaveSettings: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Server Default Key Active (Google Maps)");

      await act(async () => {
        root.unmount();
      });
    } finally {
      if (originalEnv) process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
      else delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    }
  });
});

describe("Multi-Person State Management (Task 4)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("initializes persons with 2 default participants with default colors and activePinPersonId null", async () => {
    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.persons.length).toBe(2);
    expect(result.current.state.persons[0].name).toBe("Person 1");
    expect(result.current.state.persons[1].name).toBe("Person 2");
    expect(result.current.state.persons[0].color).toBe("#10b981");
    expect(result.current.state.persons[1].color).toBe("#8b5cf6");
    expect(result.current.state.activePinPersonId).toBeNull();

    await unmount();
  });

  it("adds a person up to maximum of 8 participants and assigns palette colors", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    // Initial 2 persons
    expect(result.current.state.persons.length).toBe(2);

    // Add up to 8 persons
    for (let i = 3; i <= 8; i++) {
      await actHook(() => {
        result.current.addPerson();
      });
      expect(result.current.state.persons.length).toBe(i);
      expect(result.current.state.persons[i - 1].name).toBe(`Person ${i}`);
      expect(result.current.state.persons[i - 1].color).toBe(PERSON_COLORS[(i - 1) % PERSON_COLORS.length]);
    }
    expect(result.current.state.persons.length).toBe(8);

    // Attempt to add a 9th person should be ignored (clamped at 8)
    await actHook(() => {
      result.current.addPerson();
    });
    expect(result.current.state.persons.length).toBe(8);

    await unmount();
  });

  it("prevents removing a person when only 2 persons remain", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.persons.length).toBe(2);
    const firstId = result.current.state.persons[0].id;

    // Attempting to remove from 2 persons -> should not remove
    await actHook(() => {
      result.current.removePerson(firstId);
    });
    expect(result.current.state.persons.length).toBe(2);

    // Add a 3rd person, then remove should work
    await actHook(() => {
      result.current.addPerson();
    });
    expect(result.current.state.persons.length).toBe(3);
    const thirdId = result.current.state.persons[2].id;

    await actHook(() => {
      result.current.removePerson(thirdId);
    });
    expect(result.current.state.persons.length).toBe(2);
    expect(result.current.state.persons.find((p) => p.id === thirdId)).toBeUndefined();

    await unmount();
  });

  it("resets activePinPersonId if the targeted person is removed", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.addPerson();
    });
    const thirdPerson = result.current.state.persons[2];

    await actHook(() => {
      result.current.setActivePinPersonId(thirdPerson.id);
    });
    expect(result.current.state.activePinPersonId).toBe(thirdPerson.id);

    await actHook(() => {
      result.current.removePerson(thirdPerson.id);
    });
    expect(result.current.state.activePinPersonId).toBeNull();

    await unmount();
  });

  it("renames a person by id", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());
    const p1Id = result.current.state.persons[0].id;

    await actHook(() => {
      result.current.renamePerson(p1Id, "Alice Cooper");
    });
    expect(result.current.state.persons[0].name).toBe("Alice Cooper");
    // Other person remains unchanged
    expect(result.current.state.persons[1].name).toBe("Person 2");

    await unmount();
  });

  it("updates person location and keeps legacy pointA and pointB in sync", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());
    const p1Id = result.current.state.persons[0].id;
    const p2Id = result.current.state.persons[1].id;

    await actHook(() => {
      result.current.updatePersonLocation(p1Id, {
        address: "Siam Paragon",
        lat: 13.746,
        lng: 100.534,
      });
      result.current.updatePersonLocation(p2Id, {
        address: "Iconsiam",
        lat: 13.726,
        lng: 100.51,
      });
    });

    expect(result.current.state.persons[0].address).toBe("Siam Paragon");
    expect(result.current.state.persons[0].lat).toBe(13.746);
    expect(result.current.state.persons[0].lng).toBe(100.534);

    expect(result.current.state.pointA).toEqual({
      address: "Siam Paragon",
      lat: 13.746,
      lng: 100.534,
    });
    expect(result.current.state.pointB).toEqual({
      address: "Iconsiam",
      lat: 13.726,
      lng: 100.51,
    });

    await unmount();
  });

  it("sets and toggles activePinPersonId and syncs activePinMode", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());
    const p1Id = result.current.state.persons[0].id;
    const p2Id = result.current.state.persons[1].id;

    await actHook(() => {
      result.current.setActivePinPersonId(p1Id);
    });
    expect(result.current.state.activePinPersonId).toBe(p1Id);
    expect(result.current.state.activePinMode).toBe("A");

    await actHook(() => {
      result.current.setActivePinPersonId(p2Id);
    });
    expect(result.current.state.activePinPersonId).toBe(p2Id);
    expect(result.current.state.activePinMode).toBe("B");

    await actHook(() => {
      result.current.setActivePinPersonId(null);
    });
    expect(result.current.state.activePinPersonId).toBeNull();
    expect(result.current.state.activePinMode).toBeNull();

    await unmount();
  });

  it("defaults provider to google when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present in env", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaEnvTestKey";

    try {
      const { result, unmount } = await renderHook(() => useSearchState());
      expect(result.current.settings.activeProvider).toBe("google");
      await unmount();
    } finally {
      if (originalEnv) process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
      else delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    }
  });

  it("hydrates state from ?s=... share code via /api/share", async () => {
    let requestedShareUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedShareUrl = url.toString();
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            query: "Matcha Latte",
            persons: [
              { id: "s1", name: "Alice", address: "Siam Square", lat: 13.7469, lng: 100.534, color: "#10b981" },
              { id: "s2", name: "Bob", address: "Silom Complex", lat: 13.726, lng: 100.51, color: "#8b5cf6" },
              { id: "s3", name: "Charlie", address: "EmQuartier", lat: 13.731, lng: 100.569, color: "#f59e0b" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    setupDOM("?s=X7k9Pq");
    const { result, unmount } = await renderHook(() => useSearchState());

    // Wait for URL share code hydration effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(requestedShareUrl).toContain("/api/share?code=X7k9Pq");
    expect(result.current.state.query).toBe("Matcha Latte");
    expect(result.current.state.persons.length).toBe(3);
    expect(result.current.state.persons[0].name).toBe("Alice");
    expect(result.current.state.persons[1].name).toBe("Bob");
    expect(result.current.state.persons[2].name).toBe("Charlie");
    expect(result.current.state.pointA?.address).toBe("Siam Square");
    expect(result.current.state.pointB?.address).toBe("Silom Complex");

    await unmount();
  });

  it("hydrates legacy URL params into persons[0] and persons[1]", async () => {
    setupDOM(
      "?a_lat=13.7563&a_lng=100.5018&a_name=Location%20A&b_lat=13.7245&b_lng=100.5284&b_name=Location%20B&q=Milk%20Tea"
    );

    const { result, unmount } = await renderHook(() => useSearchState());

    expect(result.current.state.persons[0].address).toBe("Location A");
    expect(result.current.state.persons[0].lat).toBe(13.7563);
    expect(result.current.state.persons[0].lng).toBe(100.5018);
    expect(result.current.state.persons[1].address).toBe("Location B");
    expect(result.current.state.persons[1].lat).toBe(13.7245);
    expect(result.current.state.persons[1].lng).toBe(100.5284);
    expect(result.current.state.query).toBe("Milk Tea");

    await unmount();
  });

  it("executeSearch sends persons array to /api/search-midpoint", async () => {
    let capturedBody: any = null;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(
        JSON.stringify({
          success: true,
          midpoint: { lat: 13.73, lng: 100.52 },
          totalDistanceAB: 4.5,
          branches: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.addPerson();
    });

    await actHook(() => {
      result.current.updatePersonLocation(result.current.state.persons[0].id, {
        address: "Point 1",
        lat: 13.75,
        lng: 100.5,
      });
      result.current.updatePersonLocation(result.current.state.persons[1].id, {
        address: "Point 2",
        lat: 13.72,
        lng: 100.52,
      });
      result.current.updatePersonLocation(result.current.state.persons[2].id, {
        address: "Point 3",
        lat: 13.74,
        lng: 100.55,
      });
      result.current.setQuery("Specialty Coffee");
    });

    await actHook(async () => {
      await result.current.executeSearch();
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.persons).toBeDefined();
    expect(capturedBody.persons.length).toBe(3);
    expect(capturedBody.persons[0].address).toBe("Point 1");
    expect(capturedBody.persons[1].address).toBe("Point 2");
    expect(capturedBody.persons[2].address).toBe("Point 3");
    expect(capturedBody.query).toBe("Specialty Coffee");

    await unmount();
  });

  it("executeSearch rejects search if a 3rd person has an empty address", async () => {
    const { result, act: actHook, unmount } = await renderHook(() => useSearchState());

    await actHook(() => {
      result.current.addPerson();
    });

    await actHook(() => {
      result.current.updatePersonLocation(result.current.state.persons[0].id, {
        address: "Point 1",
        lat: 13.75,
        lng: 100.5,
      });
      result.current.updatePersonLocation(result.current.state.persons[1].id, {
        address: "Point 2",
        lat: 13.72,
        lng: 100.52,
      });
      // 3rd person left blank
      result.current.setQuery("Specialty Coffee");
    });

    await actHook(async () => {
      await result.current.executeSearch();
    });

    expect(result.current.state.error).toBe(
      "Please provide a location for all participants and a target venue/brand name."
    );

    await unmount();
  });
});

describe("Task 4: ShareModal Component", () => {
  const originalFetch = globalThis.fetch;
  const samplePersons: Person[] = [
    { id: "p1", name: "Alice", address: "Siam", lat: 13.75, lng: 100.5, color: "#10b981" },
    { id: "p2", name: "Bob", address: "Silom", lat: 13.72, lng: 100.52, color: "#8b5cf6" },
  ];

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
        React.createElement(ShareModal, {
          isOpen: false,
          onClose: () => {},
          persons: samplePersons,
          query: "Starbucks",
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.childNodes.length).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders modal with default 24h expiration selector and closes on cancel", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);
    let closed = false;

    await act(async () => {
      root.render(
        React.createElement(ShareModal, {
          isOpen: true,
          onClose: () => {
            closed = true;
          },
          persons: samplePersons,
          query: "Starbucks",
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const text = collectTextContent(container);
    expect(text).toContain("Share Search");
    expect(text).toContain("24 Hours");
    expect(text).toContain("3 Days");
    expect(text).toContain("7 Days");
    expect(text).toContain("Generate Share Link");

    // Close button
    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const closeBtn = buttons.find(
      (btn) => collectTextContent(btn).includes("Cancel") || btn["aria-label"] === "Close"
    );
    expect(closeBtn).toBeDefined();

    await act(async () => {
      getReactProps(closeBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(closed).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("generates share link via POST /api/share and copies to clipboard", async () => {
    let capturedBody: any = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(
        JSON.stringify({
          success: true,
          code: "AbCd12",
          expiresAt: Date.now() + 72 * 3600 * 1000,
          shareUrl: "/?s=AbCd12",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        React.createElement(ShareModal, {
          isOpen: true,
          onClose: () => {},
          persons: samplePersons,
          query: "Starbucks",
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    // Select 3 days expiration
    const threeDaysBtn = buttons.find((btn) => collectTextContent(btn).includes("3 Days"));
    expect(threeDaysBtn).toBeDefined();

    await act(async () => {
      getReactProps(threeDaysBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Click Generate Share Link
    const generateBtn = buttons.find((btn) => collectTextContent(btn).includes("Generate Share Link"));
    expect(generateBtn).toBeDefined();

    await act(async () => {
      getReactProps(generateBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.query).toBe("Starbucks");
    expect(capturedBody.expiresInHours).toBe(72);
    expect(capturedBody.persons.length).toBe(2);

    // Verify share link displayed in input
    const inputNode = findElement(container, (n) => n.tagName === "INPUT");
    expect(inputNode).not.toBeNull();
    expect(getReactProps(inputNode!)?.value).toContain("s=AbCd12");
    const updatedButtons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const textAfterGen = collectTextContent(container);
    expect(textAfterGen).toContain("3 days");

    // Click Copy Link button
    const copyBtn = updatedButtons.find((btn) => collectTextContent(btn).includes("Copy"));
    expect(copyBtn).toBeDefined();

    await act(async () => {
      getReactProps(copyBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(writtenClipboardText).toContain("s=AbCd12");
    const textAfterCopy = collectTextContent(container);
    expect(textAfterCopy).toContain("Copied");

    await act(async () => {
      root.unmount();
    });
  });

  it("handles error during share link generation gracefully", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate share link",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        React.createElement(ShareModal, {
          isOpen: true,
          onClose: () => {},
          persons: samplePersons,
          query: "Starbucks",
        })
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const generateBtn = buttons.find((btn) => collectTextContent(btn).includes("Generate Share Link"));

    await act(async () => {
      getReactProps(generateBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 10));
    });

    const text = collectTextContent(container);
    expect(text).toContain("Failed to generate share link");

    await act(async () => {
      root.unmount();
    });
  });
});
