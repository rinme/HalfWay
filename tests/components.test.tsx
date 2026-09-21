import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppSettings, LocationPoint } from "../src/types";
import { ScoredBranch, LatLng } from "../src/lib/geo";
import { Header } from "../src/components/Header";
import { LocationInput } from "../src/components/LocationInput";
import { SearchForm } from "../src/components/SearchForm";
import { ResultCard } from "../src/components/ResultCard";
import { ResultsList } from "../src/components/ResultsList";

// --- Mock DOM Environment for React Client Component Tests in Bun ---

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
  contains: (target: MockElement) => boolean;
  addEventListener: (event: string, fn: unknown) => void;
  removeEventListener: (event: string, fn: unknown) => void;
  style: Record<string, unknown>;
  setAttribute: (k: string, v: unknown) => void;
  removeAttribute: (k: string) => void;
  getAttribute: (k: string) => unknown;
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
  addEventListener: (event: string, fn: (e: unknown) => void) => void;
  removeEventListener: (event: string, fn: (e: unknown) => void) => void;
  dispatchEvent: (event: { type: string; [key: string]: unknown }) => boolean;
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
    href: string;
    search: string;
    pathname: string;
  };
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
}

let docListeners: Record<string, ((e: unknown) => void)[]> = {};
let lastCopiedText = "";
let lastAlertMessage = "";
let mockGeolocationBehavior: "success" | "error" = "success";

function createMockDoc(win: WindowMock): MockDoc {
  docListeners = {};
  const doc: MockDoc = {
    nodeType: 9,
    nodeName: "#document",
    defaultView: win,
    createElement: (tag: string) => createMockElement(tag, doc),
    createElementNS: (_ns: string, tag: string) => createMockElement(tag, doc),
    createTextNode: (text: string) => {
      const textNode = {
        nodeType: 3,
        textContent: text,
        get nodeValue() {
          return this.textContent;
        },
        set nodeValue(v: string) {
          this.textContent = v;
        },
        get data() {
          return this.textContent;
        },
        set data(v: string) {
          this.textContent = v;
        },
        nodeName: "#text",
        childNodes: [],
        ownerDocument: doc,
      };
      return textNode;
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
    setAttribute: (k: string, v: unknown) => {
      el[k] = v;
    },
    removeAttribute: (k: string) => {
      delete el[k];
    },
    getAttribute: (k: string) => {
      return el[k];
    },
  };
  return el;
}

function setupDOM() {
  lastCopiedText = "";
  lastAlertMessage = "";
  mockGeolocationBehavior = "success";

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
      href: "http://localhost:3000/?lat_a=13.75&lng_a=100.5&query=starbucks",
      search: "?lat_a=13.75&lng_a=100.5&query=starbucks",
      pathname: "/",
    },
    navigator: {
      clipboard: {
        writeText: async (text: string) => {
          lastCopiedText = text;
        },
      },
      geolocation: {
        getCurrentPosition: (success, error) => {
          if (mockGeolocationBehavior === "success") {
            success({
              coords: {
                latitude: 13.7563,
                longitude: 100.5018,
              },
            });
          } else {
            error?.({
              code: 1,
              message: "User denied Geolocation",
            });
          }
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
    navigator: WindowMock["navigator"];
    alert: (msg: string) => void;
    IS_REACT_ACT_ENVIRONMENT: boolean;
  } & WindowMock;

  globalScope.window = win;
  globalScope.document = doc;
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

const mockBranch1: ScoredBranch = {
  id: "branch-1",
  name: "Starbucks Siam Paragon",
  address: "991 Rama I Rd, Pathum Wan, Bangkok",
  lat: 13.746,
  lng: 100.534,
  distA: 3.2,
  distB: 3.5,
  distMid: 0.25,
  fairnessScore: 7.3,
  fairnessDelta: 0.3,
  tier: "primary",
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=13.746,100.534",
};

const mockBranch2: ScoredBranch = {
  id: "branch-2",
  name: "Starbucks CentralWorld",
  address: "999/9 Rama I Rd, Pathum Wan, Bangkok",
  lat: 13.744,
  lng: 100.539,
  distA: 4.8,
  distB: 2.1,
  distMid: 1.4,
  fairnessScore: 12.3,
  fairnessDelta: 2.7,
  tier: "extended",
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=13.744,100.539",
};

describe("Task 7: Split Layout & UI Components", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setupDOM();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ==========================================
  // Header Component Tests
  // ==========================================
  describe("Header Component", () => {
    it("renders branding and OpenStreetMap provider badge", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      const settings: AppSettings = {
        googleMapsApiKey: "",
        activeProvider: "osm",
      };

      await act(async () => {
        root.render(
          React.createElement(Header, {
            settings,
            onOpenSettings: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("HalfWay");
      expect(text).toContain("Fair venue midpoint matching");
      expect(text).toContain("OpenStreetMap");

      await act(async () => {
        root.unmount();
      });
    });

    it("renders Google Maps provider badge when activeProvider is google", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      const settings: AppSettings = {
        googleMapsApiKey: "AIzaTestKey",
        activeProvider: "google",
      };

      await act(async () => {
        root.render(
          React.createElement(Header, {
            settings,
            onOpenSettings: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Google Maps");

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers onOpenSettings callback when settings button is clicked", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let settingsOpened = false;

      await act(async () => {
        root.render(
          React.createElement(Header, {
            settings: { googleMapsApiKey: "", activeProvider: "osm" },
            onOpenSettings: () => {
              settingsOpened = true;
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const settingsButton = buttons.find((b) => getReactProps(b)?.title?.includes("Settings"));
      expect(settingsButton).toBeDefined();

      await act(async () => {
        getReactProps(settingsButton!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(settingsOpened).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });

    it("copies current URL to clipboard when share button is clicked", async () => {
      const { doc, win } = setupDOM();
      win.location.href = "http://localhost:3000/?lat_a=13.75&lng_a=100.5";
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(Header, {
            settings: { googleMapsApiKey: "", activeProvider: "osm" },
            onOpenSettings: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const shareButton = buttons.find((b) => getReactProps(b)?.title?.includes("shareable link"));
      expect(shareButton).toBeDefined();

      await act(async () => {
        getReactProps(shareButton!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(lastCopiedText).toBe("http://localhost:3000/?lat_a=13.75&lng_a=100.5");

      await act(async () => {
        root.unmount();
      });
    });
  });

  // ==========================================
  // LocationInput Component Tests
  // ==========================================
  describe("LocationInput Component", () => {
    it("renders label, badge, and initial address", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      const point: LocationPoint = {
        lat: 13.75,
        lng: 100.5,
        address: "Siam Discovery, Bangkok",
      };

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point,
            onChange: () => {},
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Person A's Location");
      expect(text).toContain("A");

      const input = findElement(container, (n) => n.tagName === "INPUT");
      expect(input).toBeDefined();
      expect(getReactProps(input!)?.value).toBe("Siam Discovery, Bangkok");

      await act(async () => {
        root.unmount();
      });
    });

    it("resets query to empty string when point is updated to null", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      const point: LocationPoint = {
        lat: 13.75,
        lng: 100.5,
        address: "Siam Discovery, Bangkok",
      };

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point,
            onChange: () => {},
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      let input = findElement(container, (n) => n.tagName === "INPUT");
      expect(getReactProps(input!)?.value).toBe("Siam Discovery, Bangkok");

      // Rerender with point = null
      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point: null,
            onChange: () => {},
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      input = findElement(container, (n) => n.tagName === "INPUT");
      expect(getReactProps(input!)?.value).toBe("");

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers debounced geocode search after typing and selects a suggestion", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      let capturedQuery = "";
      globalThis.fetch = (async (url: string | URL | Request) => {
        capturedQuery = url.toString();
        return new Response(
          JSON.stringify({
            success: true,
            results: [
              { label: "Siam Paragon, Bangkok", lat: 13.746, lng: 100.534 },
              { label: "Siam Center, Bangkok", lat: 13.745, lng: 100.532 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      let changedPoint: LocationPoint | null = null;

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point: null,
            onChange: (p) => {
              changedPoint = p;
            },
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const input = findElement(container, (n) => n.tagName === "INPUT");
      expect(input).toBeDefined();

      // Type query
      await act(async () => {
        getReactProps(input!)?.onChange?.({ target: { value: "Siam" } });
        await new Promise((r) => setTimeout(r, 0));
      });

      await act(async () => {
        // Wait past 350ms debounce
        await new Promise((r) => setTimeout(r, 450));
      });

      expect(capturedQuery).toContain("/api/geocode?q=Siam");

      // Verify suggestions dropdown rendered
      const suggestionButtons = findAllElements(container, (n) => n.tagName === "BUTTON").filter(
        (b) => collectTextContent(b).includes("Siam")
      );
      expect(suggestionButtons.length).toBe(2);
      expect(collectTextContent(suggestionButtons[0])).toContain("Siam Paragon, Bangkok");

      // Click first suggestion
      await act(async () => {
        getReactProps(suggestionButtons[0])?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(changedPoint as LocationPoint | null).toEqual({
        lat: 13.746,
        lng: 100.534,
        address: "Siam Paragon, Bangkok",
      });

      await act(async () => {
        root.unmount();
      });
    });

    it("closes dropdown when clicking outside", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            results: [{ label: "Asok, Bangkok", lat: 13.737, lng: 100.56 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point: null,
            onChange: () => {},
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const input = findElement(container, (n) => n.tagName === "INPUT");

      await act(async () => {
        getReactProps(input!)?.onChange?.({ target: { value: "Asok" } });
        await new Promise((r) => setTimeout(r, 0));
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 450));
      });

      // Dropdown should be open
      let ul = findElement(container, (n) => n.tagName === "UL");
      expect(ul).not.toBeNull();

      // Simulate mousedown outside container
      const outsideEl = createMockElement("div", doc);
      await act(async () => {
        doc.dispatchEvent({ type: "mousedown", target: outsideEl });
        await new Promise((r) => setTimeout(r, 0));
      });

      // Dropdown should now be closed
      ul = findElement(container, (n) => n.tagName === "UL");
      expect(ul).toBeNull();

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers onTogglePinMode and indicates active state", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let pinToggled = false;

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person B's Location",
            point: null,
            onChange: () => {},
            colorClass: "bg-violet-500",
            badgeLabel: "B",
            isActivePinMode: true,
            onTogglePinMode: () => {
              pinToggled = true;
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const pinBtn = buttons.find((b) => collectTextContent(b).includes("Click Map..."));
      expect(pinBtn).toBeDefined();

      await act(async () => {
        getReactProps(pinBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(pinToggled).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });

    it("uses GPS current location and reverse-geocodes coords", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/reverse-geocode")) {
          return new Response(
            JSON.stringify({ address: "Democracy Monument, Bangkok" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 404 });
      }) as unknown as typeof fetch;

      let changedPoint: LocationPoint | null = null;

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point: null,
            onChange: (p) => {
              changedPoint = p;
            },
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const gpsBtn = buttons.find((b) => getReactProps(b)?.title?.includes("current GPS"));
      expect(gpsBtn).toBeDefined();

      await act(async () => {
        getReactProps(gpsBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(changedPoint as LocationPoint | null).toEqual({
        lat: 13.7563,
        lng: 100.5018,
        address: "Democracy Monument, Bangkok",
      });

      await act(async () => {
        root.unmount();
      });
    });

    it("handles GPS permission denied error gracefully", async () => {
      const { doc } = setupDOM();
      mockGeolocationBehavior = "error";
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(LocationInput, {
            label: "Person A's Location",
            point: null,
            onChange: () => {},
            colorClass: "bg-emerald-500",
            badgeLabel: "A",
            isActivePinMode: false,
            onTogglePinMode: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const gpsBtn = buttons.find((b) => getReactProps(b)?.title?.includes("current GPS"));

      await act(async () => {
        getReactProps(gpsBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(lastAlertMessage).toContain("Location permission denied");

      await act(async () => {
        root.unmount();
      });
    });
  });

  // ==========================================
  // SearchForm Component Tests
  // ==========================================
  describe("SearchForm Component", () => {
    it("renders both LocationInputs, brand input, and popular brand chips", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: { lat: 13.75, lng: 100.5, address: "Point A Address" },
            pointB: { lat: 13.8, lng: 100.6, address: "Point B Address" },
            query: "Starbucks",
            activePinMode: null,
            isLoading: false,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: () => {},
            onTogglePinMode: () => {},
            onSwapPoints: () => {},
            onSubmit: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Person A's Location");
      expect(text).toContain("Person B's Location");
      expect(text).toContain("Target Store or Brand");
      expect(text).toContain("Starbucks");
      expect(text).toContain("Suki Tee Noi");
      expect(text).toContain("Cafe Amazon");
      expect(text).toContain("Find Halfway Branches");

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers onSwapPoints when swap button is clicked", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let swapped = false;

      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: { lat: 13.75, lng: 100.5, address: "Point A Address" },
            pointB: { lat: 13.8, lng: 100.6, address: "Point B Address" },
            query: "Starbucks",
            activePinMode: null,
            isLoading: false,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: () => {},
            onTogglePinMode: () => {},
            onSwapPoints: () => {
              swapped = true;
            },
            onSubmit: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const swapBtn = buttons.find((b) => getReactProps(b)?.title?.includes("Swap Point A"));
      expect(swapBtn).toBeDefined();

      await act(async () => {
        getReactProps(swapBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(swapped).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers onQueryChange when a popular brand chip is clicked", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let selectedBrand = "";

      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: null,
            pointB: null,
            query: "",
            activePinMode: null,
            isLoading: false,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: (b) => {
              selectedBrand = b;
            },
            onTogglePinMode: () => {},
            onSwapPoints: () => {},
            onSubmit: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const sukiBtn = buttons.find((b) => collectTextContent(b).trim() === "Suki Tee Noi");
      expect(sukiBtn).toBeDefined();

      await act(async () => {
        getReactProps(sukiBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(selectedBrand).toBe("Suki Tee Noi");

      await act(async () => {
        root.unmount();
      });
    });

    it("disables submit button when inputs are incomplete or loading", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      // Incomplete: pointA is null
      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: null,
            pointB: { lat: 13.8, lng: 100.6, address: "Point B" },
            query: "Starbucks",
            activePinMode: null,
            isLoading: false,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: () => {},
            onTogglePinMode: () => {},
            onSwapPoints: () => {},
            onSubmit: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const submitBtn = buttons.find((b) => collectTextContent(b).includes("Find Halfway Branches"));
      expect(submitBtn).toBeDefined();
      expect(getReactProps(submitBtn!)?.disabled).toBe(true);

      // Loading state
      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: { lat: 13.75, lng: 100.5, address: "Point A" },
            pointB: { lat: 13.8, lng: 100.6, address: "Point B" },
            query: "Starbucks",
            activePinMode: null,
            isLoading: true,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: () => {},
            onTogglePinMode: () => {},
            onSwapPoints: () => {},
            onSubmit: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const loadingBtn = findAllElements(container, (n) => n.tagName === "BUTTON").find((b) =>
        collectTextContent(b).includes("Searching Midpoint Branches...")
      );
      expect(loadingBtn).toBeDefined();
      expect(getReactProps(loadingBtn!)?.disabled).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });

    it("enables submit button and calls onSubmit when all required fields exist", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let submitted = false;

      await act(async () => {
        root.render(
          React.createElement(SearchForm, {
            pointA: { lat: 13.75, lng: 100.5, address: "Point A" },
            pointB: { lat: 13.8, lng: 100.6, address: "Point B" },
            query: "Starbucks",
            activePinMode: null,
            isLoading: false,
            onPointAChange: () => {},
            onPointBChange: () => {},
            onQueryChange: () => {},
            onTogglePinMode: () => {},
            onSwapPoints: () => {},
            onSubmit: () => {
              submitted = true;
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const buttons = findAllElements(container, (n) => n.tagName === "BUTTON");
      const submitBtn = buttons.find((b) => collectTextContent(b).includes("Find Halfway Branches"));
      expect(submitBtn).toBeDefined();
      expect(getReactProps(submitBtn!)?.disabled).toBe(false);

      await act(async () => {
        getReactProps(submitBtn!)?.onClick?.();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(submitted).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });
  });

  // ==========================================
  // ResultCard Component Tests
  // ==========================================
  describe("ResultCard Component", () => {
    it("renders branch rank, name, address, and distances", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(ResultCard, {
            branch: mockBranch1,
            rank: 1,
            isHighlighted: false,
            onHover: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("1");
      expect(text).toContain("Starbucks Siam Paragon");
      expect(text).toContain("991 Rama I Rd, Pathum Wan, Bangkok");
      expect(text).toContain("Fairness: 7.3 km");
      expect(text).toContain("3.2 km"); // To Person A
      expect(text).toContain("3.5 km"); // To Person B
      expect(text).toContain("±0.3 km"); // Difference
      expect(text).toContain("0.25 km from exact midpoint");

      const link = findElement(container, (n) => n.tagName === "A");
      expect(link).not.toBeNull();
      expect(getReactProps(link!)?.href).toBe(mockBranch1.googleMapsUrl);

      await act(async () => {
        root.unmount();
      });
    });

    it("triggers onHover on mouseenter and mouseleave", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);
      let hoveredId: string | null = "initial";

      await act(async () => {
        root.render(
          React.createElement(ResultCard, {
            branch: mockBranch1,
            rank: 1,
            isHighlighted: true,
            onHover: (id) => {
              hoveredId = id;
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      // The top-level div has onMouseEnter and onMouseLeave
      const cardDiv = container.childNodes[0];
      expect(cardDiv).toBeDefined();

      await act(async () => {
        getReactProps(cardDiv)?.onMouseEnter?.();
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(hoveredId).toBe("branch-1");

      await act(async () => {
        getReactProps(cardDiv)?.onMouseLeave?.();
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(hoveredId).toBeNull();

      await act(async () => {
        root.unmount();
      });
    });

    it("styles fairness badge according to fairnessDelta threshold", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      // Render branch with fairnessDelta > 0.5 (mockBranch2: 2.7 km)
      await act(async () => {
        root.render(
          React.createElement(ResultCard, {
            branch: mockBranch2,
            rank: 2,
            isHighlighted: false,
            onHover: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const span = findAllElements(container, (n) => n.tagName === "SPAN").find((s) =>
        collectTextContent(s).includes("Fairness: 12.3 km")
      );
      expect(span).toBeDefined();
      const spanProps = getReactProps(span!);
      expect(spanProps?.className).toContain("bg-amber-50");

      await act(async () => {
        root.unmount();
      });
    });
  });

  // ==========================================
  // ResultsList Component Tests
  // ==========================================
  describe("ResultsList Component", () => {
    it("renders error state when error is provided", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(ResultsList, {
            branches: [],
            midpoint: null,
            totalDistanceAB: null,
            highlightedBranchId: null,
            error: "Failed to connect to search service.",
            onHoverBranch: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Failed to connect to search service.");

      await act(async () => {
        root.unmount();
      });
    });

    it("renders empty state when branches array is empty", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      await act(async () => {
        root.render(
          React.createElement(ResultsList, {
            branches: [],
            midpoint: null,
            totalDistanceAB: null,
            highlightedBranchId: null,
            error: null,
            onHoverBranch: () => {},
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("No branches displayed yet");
      expect(text).toContain("Enter Point A, Point B, and click \"Find Halfway Branches\".");

      await act(async () => {
        root.unmount();
      });
    });

    it("renders summary banner and list of ResultCards when branches exist", async () => {
      const { doc } = setupDOM();
      const container = createMockElement("div", doc);
      const root = createRoot(container as unknown as Element);

      const midpoint: LatLng = { lat: 13.745, lng: 100.536 };
      let hoveredBranch: string | null = null;

      await act(async () => {
        root.render(
          React.createElement(ResultsList, {
            branches: [mockBranch1, mockBranch2],
            midpoint,
            totalDistanceAB: 6.7,
            highlightedBranchId: "branch-1",
            error: null,
            onHoverBranch: (id) => {
              hoveredBranch = id;
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      const text = collectTextContent(container);
      expect(text).toContain("Distance A to B: 6.7 km");
      expect(text).toContain("2 branches found");
      expect(text).toContain("Starbucks Siam Paragon");
      expect(text).toContain("Starbucks CentralWorld");

      await act(async () => {
        root.unmount();
      });
    });
  });
});
