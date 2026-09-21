import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ScoredBranch, LatLng } from "../src/lib/geo";

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
  id?: string;
  src?: string;
  async?: boolean;
  onload?: ((e?: unknown) => void) | null;
  onerror?: ((e?: unknown) => void) | null;
  appendChild: (child: MockElement) => MockElement;
  removeChild: (child: MockElement) => MockElement;
  insertBefore: (child: MockElement, before: MockElement) => MockElement;
  replaceChild: (newChild: MockElement, oldChild: MockElement) => MockElement;
  contains: (target: MockElement) => boolean;
  addEventListener: (event: string, fn: unknown) => void;
  removeEventListener: (event: string, fn: unknown) => void;
  style: Record<string, unknown>;
  _className?: string;
  className?: string;
  setAttribute: (k: string, v: unknown) => void;
  removeAttribute: (k: string) => void;
  getAttribute: (k: string) => unknown;
  [key: string]: unknown;
}

interface MockDoc {
  nodeType: number;
  nodeName: string;
  defaultView: WindowMock;
  head: MockElement;
  body: MockElement;
  createElement: (tag: string) => MockElement;
  createElementNS: (ns: string, tag: string) => MockElement;
  createTextNode: (text: string) => {
    nodeType: number;
    textContent: string;
    nodeName: "#text";
    childNodes: MockElement[];
    ownerDocument: MockDoc;
  };
  getElementById: (id: string) => MockElement | null;
  addEventListener: (event: string, fn: (e: unknown) => void) => void;
  removeEventListener: (event: string, fn: (e: unknown) => void) => void;
  dispatchEvent: (event: { type: string; [key: string]: unknown }) => boolean;
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
    href: string;
  };
  history: {
    replaceState: (state: unknown, title: string, url: string) => void;
  };
  localStorage: StorageMock;
  navigator: {
    clipboard: {
      writeText: (text: string) => Promise<void>;
    };
    geolocation: {
      getCurrentPosition: (
        success: (pos: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err: { code: number; message: string }) => void
      ) => void;
    };
  };
  alert: (msg: string) => void;
  window?: WindowMock;
  self?: WindowMock;
  document?: MockDoc;
  google?: any;
  gm_authFailure?: () => void;
}

let mockLocalStorage: Record<string, string> = {};
let currentSearch = "";
let replacedUrl = "";
let lastCopiedText = "";
let lastAlertMessage = "";
const docListeners: Record<string, ((e: unknown) => void)[]> = {};

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
    replaceChild: (newChild: MockElement, oldChild: MockElement) => {
      const idx = el.childNodes.indexOf(oldChild);
      if (idx !== -1) {
        newChild.parentNode = el;
        el.childNodes.splice(idx, 1, newChild);
      }
      return oldChild;
    },
    contains: (target: MockElement) => {
      let curr: MockElement | undefined = target;
      while (curr) {
        if (curr === el) return true;
        curr = curr.parentNode;
      }
      return false;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {},
    _className: "",
    get className(): string {
      return (
        this._className ||
        (typeof this["class"] === "string" ? this["class"] : "") ||
        ""
      );
    },
    set className(val: string) {
      this._className = val;
    },
    setAttribute: (k: string, v: unknown) => {
      el[k] = v;
      if (k === "class") {
        el.className = String(v);
      }
    },
    removeAttribute: (k: string) => {
      delete el[k];
      if (k === "class") {
        el.className = "";
      }
    },
    getAttribute: (k: string) => {
      return el[k];
    },
  };
  return el;
}

function createMockDoc(win: WindowMock): MockDoc {
  const head = createMockElement("head", null as any);
  const body = createMockElement("body", null as any);

  const doc: MockDoc = {
    nodeType: 9,
    nodeName: "#document",
    defaultView: win,
    head,
    body,
    createElement: (tag: string) => createMockElement(tag, doc),
    createElementNS: (_ns: string, tag: string) => createMockElement(tag, doc),
    createTextNode: (text: string) => ({
      nodeType: 3,
      textContent: text,
      nodeName: "#text",
      childNodes: [],
      ownerDocument: doc,
    }),
    getElementById: (id: string) => {
      const findId = (node: MockElement): MockElement | null => {
        if (node.id === id) return node;
        for (const child of node.childNodes || []) {
          const found = findId(child);
          if (found) return found;
        }
        return null;
      };
      return findId(head) || findId(body);
    },
    addEventListener: (event: string, fn: (e: unknown) => void) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: (e: unknown) => void) => {
      if (docListeners[event]) {
        docListeners[event] = docListeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (event: { type: string; [key: string]: unknown }) => {
      const listeners = docListeners[event.type] || [];
      for (const fn of listeners) {
        fn(event);
      }
      return true;
    },
  };

  head.ownerDocument = doc;
  body.ownerDocument = doc;
  return doc;
}

function setupDOM(initialSearch: string = "") {
  mockLocalStorage = {};
  currentSearch = initialSearch
    ? initialSearch.startsWith("?")
      ? initialSearch
      : `?${initialSearch}`
    : "";
  replacedUrl = "";
  lastCopiedText = "";
  lastAlertMessage = "";

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
      href: "http://localhost:3000/",
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
    navigator: {
      clipboard: {
        writeText: async (text: string) => {
          lastCopiedText = text;
        },
      },
      geolocation: {
        getCurrentPosition: (success) => {
          success({
            coords: {
              latitude: 13.7563,
              longitude: 100.5018,
            },
          });
        },
      },
    },
    alert: (msg: string) => {
      lastAlertMessage = msg;
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
    navigator: WindowMock["navigator"];
    alert: (msg: string) => void;
    IS_REACT_ACT_ENVIRONMENT: boolean;
  } & WindowMock;

  globalScope.window = win;
  globalScope.document = doc;
  globalScope.localStorage = win.localStorage;
  globalScope.navigator = win.navigator;
  globalScope.alert = win.alert;
  globalScope.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(globalScope, win);

  return { doc, win };
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
  placeholder?: string;
  onClick?: () => void;
  onChange?: (e: { target: { value: string } }) => void;
  onFocus?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  className?: string;
  href?: string;
  title?: string;
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

// --- Mock Leaflet ---
const leafletSpies = {
  mapInstances: [] as any[],
  layerGroups: [] as any[],
  markers: [] as any[],
  polylines: [] as any[],
  circles: [] as any[],
  tileLayers: [] as any[],
  fitBoundsCalls: [] as any[],
  mapClickHandlers: [] as ((e: { latlng: { lat: number; lng: number } }) => void)[],
  markerDragHandlers: {} as Record<string, (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void>,
};

function resetLeafletSpies() {
  leafletSpies.mapInstances = [];
  leafletSpies.layerGroups = [];
  leafletSpies.markers = [];
  leafletSpies.polylines = [];
  leafletSpies.circles = [];
  leafletSpies.tileLayers = [];
  leafletSpies.fitBoundsCalls = [];
  leafletSpies.mapClickHandlers = [];
  leafletSpies.markerDragHandlers = {};
}

const mockLeaflet = {
  map: (container: any, opts: any) => {
    const instance = {
      container,
      opts,
      remove: mock(() => {}),
      on: mock((event: string, cb: any) => {
        if (event === "click") {
          leafletSpies.mapClickHandlers.push(cb);
        }
      }),
      fitBounds: mock((bounds: any, options: any) => {
        leafletSpies.fitBoundsCalls.push({ bounds, options });
      }),
    };
    leafletSpies.mapInstances.push(instance);
    return instance;
  },
  tileLayer: (url: string, opts: any) => {
    const tileLayer = {
      url,
      opts,
      addTo: mock(() => tileLayer),
    };
    leafletSpies.tileLayers.push(tileLayer);
    return tileLayer;
  },
  layerGroup: () => {
    const lg = {
      addTo: mock(() => lg),
      clearLayers: mock(() => {}),
    };
    leafletSpies.layerGroups.push(lg);
    return lg;
  },
  divIcon: (opts: any) => opts,
  marker: (coords: any, opts: any) => {
    const markerObj: any = {
      coords,
      opts,
      popupContent: "",
      isOpen: false,
      addTo: mock(() => markerObj),
      bindPopup: mock((content: string) => {
        markerObj.popupContent = content;
        return markerObj;
      }),
      openPopup: mock(() => {
        markerObj.isOpen = true;
        return markerObj;
      }),
      on: mock((event: string, cb: any) => {
        if (event === "dragend") {
          if (opts?.icon?.html?.includes(">A<")) {
            leafletSpies.markerDragHandlers["A"] = cb;
          } else if (opts?.icon?.html?.includes(">B<")) {
            leafletSpies.markerDragHandlers["B"] = cb;
          }
        }
      }),
    };
    leafletSpies.markers.push(markerObj);
    return markerObj;
  },
  polyline: (coords: any, opts: any) => {
    const polylineObj = {
      coords,
      opts,
      addTo: mock(() => polylineObj),
    };
    leafletSpies.polylines.push(polylineObj);
    return polylineObj;
  },
  circle: (coords: any, opts: any) => {
    const circleObj = {
      coords,
      opts,
      addTo: mock(() => circleObj),
    };
    leafletSpies.circles.push(circleObj);
    return circleObj;
  },
};

// Setup initial DOM and mock module
setupDOM();

mock.module("leaflet", () => ({
  default: mockLeaflet,
  ...mockLeaflet,
}));

// Dynamically import Page component after mock.module
const { default: HalfwayFinderPage } = await import("../src/app/page");

const mockMidpoint: LatLng = {
  lat: 13.745,
  lng: 100.5365,
};

const mockBranches: ScoredBranch[] = [
  {
    id: "branch-1",
    name: "Starbucks Siam Paragon",
    address: "991 Rama I Rd, Bangkok",
    lat: 13.7462,
    lng: 100.5345,
    distances: [
      { personId: "p1", name: "Person A", distance: 0.2 },
      { personId: "p2", name: "Person B", distance: 0.6 },
    ],
    distA: 0.2,
    distB: 0.6,
    distMid: 0.25,
    fairnessScore: 1.4,
    spread: 0.4,
    fairnessDelta: 0.4,
    tier: "primary",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=13.746,100.534&destination=13.7462,100.5345",
  },
  {
    id: "branch-2",
    name: "Starbucks CentralWorld",
    address: "999/9 Rama I Rd, Bangkok",
    lat: 13.7445,
    lng: 100.539,
    distances: [
      { personId: "p1", name: "Person A", distance: 0.5 },
      { personId: "p2", name: "Person B", distance: 0.1 },
    ],
    distA: 0.5,
    distB: 0.1,
    distMid: 0.3,
    fairnessScore: 1.6,
    spread: 0.4,
    fairnessDelta: 0.4,
    tier: "primary",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=13.746,100.534&destination=13.7445,100.539",
  },
];

describe("Task 9: Main Page Assembly & Verification (HalfwayFinderPage)", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    resetLeafletSpies();
    setupDOM();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("mounts full split-layout page with Header, SearchForm, ResultsList, and MapView", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 10));
    });

    // 1. Check layout styling (responsive split screen)
    const pageContainer = container.childNodes[0];
    expect(pageContainer.className).toContain("flex flex-col h-screen w-screen overflow-hidden");

    // 2. Check Header branding
    const allText = collectTextContent(container);
    expect(allText).toContain("HalfWay");
    expect(allText).toContain("Fair venue midpoint matching");
    expect(allText).toContain("OpenStreetMap");

    // 3. Check SearchForm inputs & buttons
    expect(allText).toContain("Person A's Location");
    expect(allText).toContain("Person B's Location");
    expect(allText).toContain("Target Store or Brand");
    expect(allText).toContain("Find Halfway Branches");

    // 4. Check initial ResultsList empty state
    expect(allText).toContain("No branches displayed yet");

    // 5. Check MapView mounted Leaflet instance
    expect(leafletSpies.mapInstances.length).toBe(1);

    // 6. SettingsModal should not be open
    expect(allText).not.toContain("Map & API Settings");

    await act(async () => {
      root.unmount();
    });
  });

  it("opens and closes SettingsModal from Header button and updates settings", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 10));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const settingsBtn = buttons.find((b) => getReactProps(b)?.title?.includes("Settings"));
    expect(settingsBtn).toBeDefined();

    // Open settings modal
    await act(async () => {
      getReactProps(settingsBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    let text = collectTextContent(container);
    expect(text).toContain("Map & API Settings");
    expect(text).toContain("Active Map Provider");

    // Find cancel button in modal and click it
    const modalButtons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const cancelBtn = modalButtons.find((b) => collectTextContent(b).trim() === "Cancel");
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      getReactProps(cancelBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    text = collectTextContent(container);
    expect(text).not.toContain("Map & API Settings");

    await act(async () => {
      root.unmount();
    });
  });

  it("handles map click when activePinMode is 'A', reverse-geocodes, and auto-advances to 'B'", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/reverse-geocode")) {
        return {
          ok: true,
          json: async () => ({ success: true, address: "Siam Paragon, Bangkok" }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 10));
    });

    // 1. Activate pin mode for Point A
    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const pinBtns = buttons.filter((b) => getReactProps(b)?.title?.includes("pin on map"));
    expect(pinBtns.length).toBe(2);

    await act(async () => {
      getReactProps(pinBtns[0])?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(leafletSpies.mapClickHandlers.length).toBeGreaterThan(0);

    // 2. Simulate clicking on the Leaflet map at coordinate (13.746, 100.534)
    await act(async () => {
      const clickHandler = leafletSpies.mapClickHandlers[0];
      await clickHandler({ latlng: { lat: 13.746, lng: 100.534 } });
      await new Promise((r) => setTimeout(r, 20));
    });

    const inputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(inputs[0])?.value).toBe("Siam Paragon, Bangkok");

    // 3. Active pin mode should have auto-advanced to Point B
    // Clicking the map again should set Point B
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/reverse-geocode")) {
        return {
          ok: true,
          json: async () => ({ success: true, address: "CentralWorld, Bangkok" }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });

    await act(async () => {
      const clickHandler = leafletSpies.mapClickHandlers[0];
      await clickHandler({ latlng: { lat: 13.744, lng: 100.539 } });
      await new Promise((r) => setTimeout(r, 20));
    });

    const updatedInputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(updatedInputs[1])?.value).toBe("CentralWorld, Bangkok");

    await act(async () => {
      root.unmount();
    });
  });

  it("handles map click fallback gracefully when reverse geocoding fails", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    globalThis.fetch = mock(async () => {
      throw new Error("Network error during reverse geocode");
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 10));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const pinBtns = buttons.filter((b) => getReactProps(b)?.title?.includes("pin on map"));

    await act(async () => {
      getReactProps(pinBtns[0])?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      const clickHandler = leafletSpies.mapClickHandlers[0];
      await clickHandler({ latlng: { lat: 13.746123, lng: 100.534123 } });
      await new Promise((r) => setTimeout(r, 20));
    });

    const inputs = findAllElements(container, (n) => n.tagName === "INPUT");
    // Address should fall back to formatted lat, lng
    expect(getReactProps(inputs[0])?.value).toBe("13.7461, 100.5341");

    await act(async () => {
      root.unmount();
    });
  });

  it("handles marker drag and updates point address via reverse geocoding", async () => {
    const { doc } = setupDOM(
      "?a_lat=13.746&a_lng=100.534&a_name=Initial+A&b_lat=13.744&b_lng=100.539&b_name=Initial+B&q=Starbucks"
    );
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/reverse-geocode") && urlStr.includes("lat=13.75")) {
        return {
          ok: true,
          json: async () => ({ success: true, address: "Dragged A Address" }),
        } as unknown as Response;
      }
      if (urlStr.includes("/api/reverse-geocode") && urlStr.includes("lat=13.73")) {
        return {
          ok: true,
          json: async () => ({ success: true, address: "Dragged B Address" }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 20));
    });

    const initialInputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(initialInputs[0])?.value).toBe("Initial A");
    expect(getReactProps(initialInputs[1])?.value).toBe("Initial B");

    // Drag marker A
    expect(leafletSpies.markerDragHandlers["A"]).toBeDefined();
    await act(async () => {
      leafletSpies.markerDragHandlers["A"]({
        target: {
          getLatLng: () => ({ lat: 13.75, lng: 100.535 }),
        },
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    const afterDragAInputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(afterDragAInputs[0])?.value).toBe("Dragged A Address");

    // Drag marker B
    expect(leafletSpies.markerDragHandlers["B"]).toBeDefined();
    await act(async () => {
      leafletSpies.markerDragHandlers["B"]({
        target: {
          getLatLng: () => ({ lat: 13.73, lng: 100.54 }),
        },
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    const afterDragBInputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(afterDragBInputs[1])?.value).toBe("Dragged B Address");

    await act(async () => {
      root.unmount();
    });
  });

  it("handles marker drag fallback when reverse geocode fails", async () => {
    const { doc } = setupDOM(
      "?a_lat=13.746&a_lng=100.534&a_name=Initial+A&b_lat=13.744&b_lng=100.539&b_name=Initial+B"
    );
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    globalThis.fetch = mock(async () => {
      throw new Error("Network error during drag geocode");
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Drag marker A
    await act(async () => {
      leafletSpies.markerDragHandlers["A"]({
        target: {
          getLatLng: () => ({ lat: 13.7555, lng: 100.5333 }),
        },
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    const inputs = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(inputs[0])?.value).toBe("13.7555, 100.5333");

    await act(async () => {
      root.unmount();
    });
  });

  it("executes search flow, displays loading state, and renders results list", async () => {
    const { doc } = setupDOM(
      "?a_lat=13.746&a_lng=100.534&a_name=Siam+Paragon&b_lat=13.744&b_lng=100.539&b_name=CentralWorld&q=Starbucks"
    );
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    let searchCalled = false;
    let requestBody: any = null;

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/search-midpoint")) {
        searchCalled = true;
        requestBody = JSON.parse(String(init?.body || "{}"));
        return {
          ok: true,
          json: async () => ({
            success: true,
            branches: mockBranches,
            midpoint: mockMidpoint,
            totalDistanceAB: 1.25,
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Submit button should be enabled
    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const submitBtn = buttons.find((b) => collectTextContent(b).includes("Find Halfway Branches"));
    expect(submitBtn).toBeDefined();
    expect(getReactProps(submitBtn!)?.disabled).toBeFalsy();

    // Click submit
    await act(async () => {
      getReactProps(submitBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(searchCalled).toBe(true);
    expect(requestBody.pointA.lat).toBe(13.746);
    expect(requestBody.pointB.lat).toBe(13.744);
    expect(requestBody.query).toBe("Starbucks");

    // ResultsList should display the branch cards and distance banner
    const text = collectTextContent(container);
    expect(text).toContain("Distance A to B: 1.25 km");
    expect(text).toContain("2 branches found");
    expect(text).toContain("Starbucks Siam Paragon");
    expect(text).toContain("Starbucks CentralWorld");

    // Hovering on result card updates highlighted branch
    const resultCards = findAllElements(container, (n) => {
      const props = getReactProps(n);
      return typeof props?.onMouseEnter === "function" && collectTextContent(n).includes("Starbucks Siam Paragon");
    });
    expect(resultCards.length).toBeGreaterThan(0);

    await act(async () => {
      getReactProps(resultCards[0])?.onMouseEnter?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Markers in Leaflet should have updated
    expect(leafletSpies.markers.length).toBeGreaterThan(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("handles search error gracefully and renders error banner", async () => {
    const { doc } = setupDOM(
      "?a_lat=13.746&a_lng=100.534&a_name=Siam+Paragon&b_lat=13.744&b_lng=100.539&b_name=CentralWorld&q=Starbucks"
    );
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/search-midpoint")) {
        return {
          ok: false,
          json: async () => ({
            success: false,
            error: "Failed to connect to Overpass API",
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }) as any;

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 20));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const submitBtn = buttons.find((b) => collectTextContent(b).includes("Find Halfway Branches"));

    await act(async () => {
      getReactProps(submitBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 20));
    });

    const text = collectTextContent(container);
    expect(text).toContain("Failed to connect to Overpass API");

    await act(async () => {
      root.unmount();
    });
  });

  it("swaps Point A and Point B when swap button is clicked", async () => {
    const { doc } = setupDOM(
      "?a_lat=13.746&a_lng=100.534&a_name=Location+Alpha&b_lat=13.744&b_lng=100.539&b_name=Location+Beta"
    );
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 20));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const swapBtn = buttons.find((b) => getReactProps(b)?.title?.includes("Swap Point A"));
    expect(swapBtn).toBeDefined();

    // Verify initial positions
    const inputsBefore = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(inputsBefore[0])?.value).toBe("Location Alpha");
    expect(getReactProps(inputsBefore[1])?.value).toBe("Location Beta");

    // Click swap
    await act(async () => {
      getReactProps(swapBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    const inputsAfter = findAllElements(container, (n) => n.tagName === "INPUT");
    expect(getReactProps(inputsAfter[0])?.value).toBe("Location Beta");
    expect(getReactProps(inputsAfter[1])?.value).toBe("Location Alpha");

    await act(async () => {
      root.unmount();
    });
  });

  it("changes search query when clicking quick brand chip", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(React.createElement(HalfwayFinderPage));
      await new Promise((r) => setTimeout(r, 10));
    });

    const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
    const sukiBtn = buttons.find((b) => collectTextContent(b).trim() === "Suki Tee Noi");
    expect(sukiBtn).toBeDefined();

    await act(async () => {
      getReactProps(sukiBtn!)?.onClick?.();
      await new Promise((r) => setTimeout(r, 0));
    });

    const inputs = findAllElements(container, (n) => n.tagName === "INPUT");
    const brandInput = inputs.find((i) => getReactProps(i)?.placeholder?.includes("Starbucks"));
    expect(getReactProps(brandInput!)?.value).toBe("Suki Tee Noi");

    await act(async () => {
      root.unmount();
    });
  });
});
