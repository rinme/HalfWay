import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocationPoint, Person } from "../src/types";
import { ScoredBranch, LatLng } from "../src/lib/geo";

const happyDoc = globalThis.document;
const happyWin = globalThis.window;

// --- Mock DOM Environment ---
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
    nodeName: string;
    childNodes: MockElement[];
    ownerDocument: MockDoc;
  };
  getElementById: (id: string) => MockElement | null;
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
  alert: (msg: string) => void;
  window?: WindowMock;
  self?: WindowMock;
  document?: MockDoc;
  google?: any;
  gm_authFailure?: () => void;
}

let lastAlertMessage = "";

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
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  head.ownerDocument = doc;
  body.ownerDocument = doc;
  return doc;
}

function setupDOM() {
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
      href: "http://localhost:3000/",
      search: "",
      pathname: "/",
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
    alert: (msg: string) => void;
    IS_REACT_ACT_ENVIRONMENT: boolean;
  } & WindowMock;

  globalScope.window = win;
  globalScope.document = doc;
  globalScope.alert = win.alert;
  globalScope.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(globalScope, win);

  return { doc, win };
}

// --- Mock Leaflet ---
export const leafletSpies = {
  mapInstances: [] as any[],
  layerGroups: [] as any[],
  markers: [] as any[],
  polylines: [] as any[],
  circles: [] as any[],
  tileLayers: [] as any[],
  fitBoundsCalls: [] as any[],
  mapClickHandlers: [] as Function[],
  markerDragHandlers: {} as Record<string, Function>,
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
      on: mock((event: string, cb: Function) => {
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
      on: mock((event: string, cb: Function) => {
        if (event === "dragend") {
          markerObj.dragHandler = cb;
          if (opts?.icon?.html?.includes(">A<")) {
            leafletSpies.markerDragHandlers["A"] = cb;
          } else if (opts?.icon?.html?.includes(">B<")) {
            leafletSpies.markerDragHandlers["B"] = cb;
          }
          if (opts?.personId) {
            leafletSpies.markerDragHandlers[opts.personId] = cb;
          }
        }
        if (event === "click") {
          markerObj.clickHandler = cb;
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

// Setup DOM and leaflet mock before loading components
setupDOM();

mock.module("leaflet", () => ({
  default: mockLeaflet,
  ...mockLeaflet,
}));

mock.module("next/dynamic", () => ({
  default: () => {
    return function DynamicMock(props: any) {
      if (props.apiKey) return <GoogleMap {...props} />;
      return <LeafletMap {...props} />;
    };
  },
}));

// Import components dynamically after mock.module and setupDOM
const { LeafletMap } = await import("../src/components/map/LeafletMap");
const { GoogleMap } = await import("../src/components/map/GoogleMap");
const { MapView } = await import("../src/components/map/MapView");

const mockBranch1: ScoredBranch = {
  id: "1",
  name: "Starbucks Siam Paragon",
  address: "991 Rama I Rd, Bangkok",
  lat: 13.7462,
  lng: 100.5345,
  distances: [
    { personId: "p1", name: "Person A", distance: 0.1 },
    { personId: "p2", name: "Person B", distance: 0.5 },
  ],
  distA: 0.1,
  distB: 0.5,
  distMid: 0.25,
  fairnessScore: 1.4,
  spread: 0.4,
  fairnessDelta: 0.4,
  tier: "primary",
  googleMapsUrl: "https://maps.google.com/?q=13.7462,100.5345",
};

const mockPointA: LocationPoint = {
  address: "Siam Paragon, Rama I Rd, Pathum Wan, Bangkok",
  lat: 13.746,
  lng: 100.534,
};

const mockPointB: LocationPoint = {
  address: "CentralWorld, Ratchadamri Rd, Pathum Wan, Bangkok",
  lat: 13.744,
  lng: 100.539,
};

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
      { personId: "p1", name: "Person A", distance: 0.1 },
      { personId: "p2", name: "Person B", distance: 0.5 },
    ],
    distA: 0.1,
    distB: 0.5,
    distMid: 0.25,
    fairnessScore: 1.4,
    spread: 0.4,
    fairnessDelta: 0.4,
    tier: "primary",
    googleMapsUrl:
      "https://www.google.com/maps/dir/?api=1&origin=13.746,100.534&destination=13.7462,100.5345",
  },
  {
    id: "branch-2",
    name: "Starbucks CentralWorld",
    address: "4 Ratchadamri Rd, Bangkok",
    lat: 13.7445,
    lng: 100.5395,
    distances: [
      { personId: "p1", name: "Person A", distance: 0.6 },
      { personId: "p2", name: "Person B", distance: 0.1 },
    ],
    distA: 0.6,
    distB: 0.1,
    distMid: 0.35,
    fairnessScore: 1.7,
    spread: 0.5,
    fairnessDelta: 0.5,
    tier: "primary",
    googleMapsUrl:
      "https://www.google.com/maps/dir/?api=1&origin=13.746,100.534&destination=13.7445,100.5395",
  },
];

const mock3Persons: Person[] = [
  {
    id: "p1",
    name: "Alice",
    address: "Siam Paragon, Bangkok",
    lat: 13.746,
    lng: 100.534,
    color: "#10b981",
  },
  {
    id: "p2",
    name: "Bob",
    address: "CentralWorld, Bangkok",
    lat: 13.744,
    lng: 100.539,
    color: "#8b5cf6",
  },
  {
    id: "p3",
    name: "Charlie",
    address: "MBK Center, Bangkok",
    lat: 13.7443,
    lng: 100.5302,
    color: "#f59e0b",
  },
];

const mockMultiPersonBranches: ScoredBranch[] = [
  {
    id: "branch-multi-1",
    name: "True Coffee Siam Square",
    address: "Siam Square Soi 3, Bangkok",
    lat: 13.7448,
    lng: 100.5332,
    distances: [
      { personId: "p1", name: "Alice", distance: 0.2 },
      { personId: "p2", name: "Bob", distance: 0.6 },
      { personId: "p3", name: "Charlie", distance: 0.3 },
    ],
    distA: 0.2,
    distB: 0.6,
    distMid: 0.15,
    fairnessScore: 0.7,
    spread: 0.4,
    fairnessDelta: 0.4,
    tier: "primary",
    googleMapsUrl: "https://maps.google.com/?q=13.7448,100.5332",
  },
];

describe("Task 8: LeafletMap Component", () => {
  beforeEach(() => {
    setupDOM();
    resetLeafletSpies();
  });

  it("renders container and initializes Leaflet map with tiles", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    expect(leafletSpies.mapInstances.length).toBe(1);
    expect(leafletSpies.tileLayers.length).toBe(1);
    expect(leafletSpies.layerGroups.length).toBe(1);
    // Container should not have cursor-crosshair class when activePinMode is null
    const mapDiv = container.childNodes[0];
    expect(mapDiv.className).not.toContain("cursor-crosshair");

    // Cleanup
    await act(async () => {
      root.unmount();
    });
    expect(leafletSpies.mapInstances[0].remove).toHaveBeenCalled();
  });

  it("adds cursor-crosshair class when activePinMode is active", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode="A"
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    const mapDiv = container.childNodes[0];
    expect(mapDiv.className).toContain("cursor-crosshair");

    await act(async () => {
      root.unmount();
    });
  });

  it("renders Point A and Point B draggable markers with popups", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onMarkerDrag = mock((point: "A" | "B", coord: LatLng) => {});

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={onMarkerDrag}
        />
      );
    });

    // We should have at least 2 markers (A and B)
    expect(leafletSpies.markers.length).toBe(2);
    const markerA = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes(">A<")
    );
    const markerB = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes(">B<")
    );

    expect(markerA).toBeDefined();
    expect(markerA.opts.draggable).toBe(true);
    expect(markerA.popupContent).toContain("Point A");
    expect(markerA.popupContent).toContain(mockPointA.address);

    expect(markerB).toBeDefined();
    expect(markerB.opts.draggable).toBe(true);
    expect(markerB.popupContent).toContain("Point B");
    expect(markerB.popupContent).toContain(mockPointB.address);

    // Test dragging marker A
    expect(leafletSpies.markerDragHandlers["A"]).toBeDefined();
    leafletSpies.markerDragHandlers["A"]({
      target: { getLatLng: () => ({ lat: 13.75, lng: 100.54 }) },
    });
    expect(onMarkerDrag).toHaveBeenCalledWith("A", { lat: 13.75, lng: 100.54 });

    // Test dragging marker B
    expect(leafletSpies.markerDragHandlers["B"]).toBeDefined();
    leafletSpies.markerDragHandlers["B"]({
      target: { getLatLng: () => ({ lat: 13.74, lng: 100.55 }) },
    });
    expect(onMarkerDrag).toHaveBeenCalledWith("B", { lat: 13.74, lng: 100.55 });

    // Polyline connecting A and B
    expect(leafletSpies.polylines.length).toBe(1);
    expect(leafletSpies.polylines[0].coords).toEqual([
      [mockPointA.lat, mockPointA.lng],
      [mockPointB.lat, mockPointB.lng],
    ]);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders midpoint marker and 3km/10km dashed circles", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    // Check midpoint marker
    const midMarker = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes("🎯")
    );
    expect(midMarker).toBeDefined();
    expect(midMarker.popupContent).toContain("Fair Midpoint");

    // Check circles (3km = 3000m, 10km = 10000m)
    expect(leafletSpies.circles.length).toBe(2);
    const circle3k = leafletSpies.circles.find((c) => c.opts.radius === 3000);
    const circle10k = leafletSpies.circles.find((c) => c.opts.radius === 10000);
    expect(circle3k).toBeDefined();
    expect(circle3k.opts.color).toBe("#6366f1");
    expect(circle10k).toBeDefined();
    expect(circle10k.opts.color).toBe("#94a3b8");

    await act(async () => {
      root.unmount();
    });
  });

  it("renders numbered branch markers and auto-opens highlighted branch popup", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId="branch-2"
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    const branch1Marker = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes(">1<")
    );
    const branch2Marker = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes(">2<")
    );

    expect(branch1Marker).toBeDefined();
    expect(branch1Marker.popupContent).toContain(mockBranches[0].name);
    expect(branch1Marker.popupContent).toContain(mockBranches[0].googleMapsUrl);
    expect(branch1Marker.isOpen).toBe(false);

    expect(branch2Marker).toBeDefined();
    expect(branch2Marker.popupContent).toContain(mockBranches[1].name);
    expect(branch2Marker.popupContent).toContain("Fairness:");
    expect(branch2Marker.isOpen).toBe(true); // Auto-opened because highlightedBranchId="branch-2"

    // fitBounds should be called
    expect(leafletSpies.fitBoundsCalls.length).toBeGreaterThan(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("calls onMapClick when map instance triggers click event", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onMapClick = mock((coord: LatLng) => {});

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode="A"
          highlightedBranchId={null}
          onMapClick={onMapClick}
          onMarkerDrag={() => {}}
        />
      );
    });

    expect(leafletSpies.mapClickHandlers.length).toBeGreaterThan(0);
    leafletSpies.mapClickHandlers[0]({
      latlng: { lat: 13.755, lng: 100.525 },
    });

    expect(onMapClick).toHaveBeenCalledWith({ lat: 13.755, lng: 100.525 });

    await act(async () => {
      root.unmount();
    });
  });

  it("renders 3+ person markers and hub-and-spoke lines to centroid in LeafletMap", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={mockMidpoint}
          branches={mockMultiPersonBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    // 3 person markers + 1 midpoint marker + 1 branch marker = 5 markers
    expect(leafletSpies.markers.length).toBe(5);

    // Verify each person marker exists with correct coordinates, color, and draggable=true
    for (const person of mock3Persons) {
      const marker = leafletSpies.markers.find(
        (m) => m.coords[0] === person.lat && m.coords[1] === person.lng
      );
      expect(marker).toBeDefined();
      expect(marker.opts.draggable).toBe(true);
      expect(marker.opts.icon.html).toContain(person.color);
      expect(marker.popupContent).toContain(person.name);
      expect(marker.popupContent).toContain(person.address);
    }

    // Verify 3 hub-and-spoke dashed lines from each person to centroid midpoint
    expect(leafletSpies.polylines.length).toBe(3);
    for (const person of mock3Persons) {
      const line = leafletSpies.polylines.find(
        (l) =>
          l.coords[0][0] === person.lat &&
          l.coords[0][1] === person.lng &&
          l.coords[1][0] === mockMidpoint.lat &&
          l.coords[1][1] === mockMidpoint.lng
      );
      expect(line).toBeDefined();
      expect(line.opts.dashArray).toBe("6, 6");
      expect(line.opts.color).toBe(person.color);
    }

    // Verify midpoint circles (3km and 10km)
    expect(leafletSpies.circles.length).toBe(2);
    expect(leafletSpies.circles[0].opts.radius).toBe(3000);
    expect(leafletSpies.circles[1].opts.radius).toBe(10000);

    // Verify branch popup shows distance breakdown to each person
    const branchMarker = leafletSpies.markers.find(
      (m) =>
        m.coords[0] === mockMultiPersonBranches[0].lat &&
        m.coords[1] === mockMultiPersonBranches[0].lng
    );
    expect(branchMarker).toBeDefined();
    expect(branchMarker.popupContent).toContain("Alice: 0.2 km");
    expect(branchMarker.popupContent).toContain("Bob: 0.6 km");
    expect(branchMarker.popupContent).toContain("Charlie: 0.3 km");

    await act(async () => {
      root.unmount();
    });
  });

  it("calls onPersonMarkerDrag when person marker is dragged in LeafletMap", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onPersonMarkerDrag = mock((_id: string, _coord: LatLng) => {});

    await act(async () => {
      root.render(
        <LeafletMap
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={mockMidpoint}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onPersonMarkerDrag={onPersonMarkerDrag}
        />
      );
    });

    const p1Marker = leafletSpies.markers.find(
      (m) => m.coords[0] === mock3Persons[0].lat && m.coords[1] === mock3Persons[0].lng
    );
    expect(p1Marker).toBeDefined();
    expect(p1Marker.dragHandler).toBeDefined();

    p1Marker.dragHandler({
      target: {
        getLatLng: () => ({ lat: 13.75, lng: 100.52 }),
      },
    });

    expect(onPersonMarkerDrag).toHaveBeenCalledWith("p1", { lat: 13.75, lng: 100.52 });

    await act(async () => {
      root.unmount();
    });
  });

  it("adds cursor-crosshair class when activePinPersonId is active in LeafletMap", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <LeafletMap
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          activePinPersonId="p2"
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
        />
      );
    });

    const mapDiv = container.childNodes[0];
    expect(mapDiv.className).toContain("cursor-crosshair");

    await act(async () => {
      root.unmount();
    });
  });
});

describe("Task 8: GoogleMap Component", () => {
  beforeEach(() => {
    setupDOM();
  });

  it("calls onFallbackToOsm immediately if apiKey is empty", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onFallbackToOsm = mock(() => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey=""
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={onFallbackToOsm}
        />
      );
    });

    expect(onFallbackToOsm).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("injects Google Maps script tag into document head when apiKey is provided", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onFallbackToOsm = mock(() => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaTestApiKey123"
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={onFallbackToOsm}
        />
      );
    });

    const scriptTag = document.getElementById(
      "google-maps-script"
    ) as unknown as MockElement | null;
    expect(scriptTag).not.toBeNull();
    expect(scriptTag?.src).toContain(
      "maps.googleapis.com/maps/api/js?key=AIzaTestApiKey123"
    );
    expect(scriptTag?.src).toContain("libraries=places");

    await act(async () => {
      root.unmount();
    });
  });

  it("calls onFallbackToOsm when script onerror fires", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onFallbackToOsm = mock(() => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaFailScript"
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={onFallbackToOsm}
        />
      );
    });

    const scriptTag = document.getElementById(
      "google-maps-script"
    ) as unknown as MockElement | null;
    expect(scriptTag).not.toBeNull();

    act(() => {
      scriptTag?.onerror?.(new Event("error"));
    });

    expect(onFallbackToOsm).toHaveBeenCalled();
    expect(lastAlertMessage).toContain("Switching back to OpenStreetMap");

    await act(async () => {
      root.unmount();
    });
  });

  it("calls onFallbackToOsm when gm_authFailure triggers", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onFallbackToOsm = mock(() => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaInvalidAuth"
          pointA={null}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={onFallbackToOsm}
        />
      );
    });

    expect(typeof (window as any).gm_authFailure).toBe("function");
    (window as any).gm_authFailure();

    expect(onFallbackToOsm).toHaveBeenCalled();
    expect(lastAlertMessage).toContain("invalid API key");

    await act(async () => {
      root.unmount();
    });
  });

  it("initializes google map and adds markers when script onload fires", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const mapClickListeners: Function[] = [];
    const markerDragListeners: Record<string, Function> = {};
    const createdMarkers: any[] = [];
    const createdCircles: any[] = [];
    const createdPolylines: any[] = [];
    const createdInfoWindows: any[] = [];

    // Prepare mock google object (assigned when script loads)
    delete (window as any).google;
    const mockGoogle = {
      maps: {
        Map: class {
          center: any;
          zoom: number;
          constructor(c: any, opts: any) {
            this.center = opts.center;
            this.zoom = opts.zoom;
          }
          addListener(evt: string, cb: Function) {
            if (evt === "click") mapClickListeners.push(cb);
          }
          fitBounds() {}
        },
        Marker: class {
          opts: any;
          map: any;
          listeners: Record<string, Function> = {};
          constructor(opts: any) {
            this.opts = opts;
            this.map = opts.map;
            createdMarkers.push(this);
          }
          addListener(evt: string, cb: Function) {
            this.listeners[evt] = cb;
            if (evt === "dragend") {
              if (this.opts?.label?.text === "A") markerDragListeners["A"] = cb;
              if (this.opts?.label?.text === "B") markerDragListeners["B"] = cb;
            }
          }
          setMap(m: any) {
            this.map = m;
          }
        },
        Polyline: class {
          opts: any;
          map: any;
          constructor(opts: any) {
            this.opts = opts;
            this.map = opts.map;
            createdPolylines.push(this);
          }
          setMap(m: any) {
            this.map = m;
          }
        },
        Circle: class {
          opts: any;
          map: any;
          constructor(opts: any) {
            this.opts = opts;
            this.map = opts.map;
            createdCircles.push(this);
          }
          setMap(m: any) {
            this.map = m;
          }
        },
        InfoWindow: class {
          opts: any;
          isOpen = false;
          content: string;
          constructor(opts: any) {
            this.opts = opts;
            this.content = opts.content;
            createdInfoWindows.push(this);
          }
          open() {
            this.isOpen = true;
          }
          close() {
            this.isOpen = false;
          }
        },
        LatLngBounds: class {
          extend() {}
        },
        Point: class {
          x: number;
          y: number;
          constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
          }
        },
      },
    };

    const onMapClick = mock((coord: LatLng) => {});
    const onMarkerDrag = mock((point: "A" | "B", coord: LatLng) => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaValidKey"
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode="B"
          highlightedBranchId="branch-1"
          onMapClick={onMapClick}
          onMarkerDrag={onMarkerDrag}
          onFallbackToOsm={() => {}}
        />
      );
    });

    const scriptTag = document.getElementById(
      "google-maps-script"
    ) as unknown as MockElement | null;
    expect(scriptTag).not.toBeNull();

    // Trigger script load with google maps defined
    await act(async () => {
      (window as any).google = mockGoogle;
      scriptTag?.onload?.(new Event("load"));
    });

    // Check map crosshair cursor
    const mapDiv = container.childNodes[0];
    expect(mapDiv.className).toContain("cursor-crosshair");

    // Check map click
    expect(mapClickListeners.length).toBeGreaterThan(0);
    mapClickListeners[0]({
      latLng: { lat: () => 13.76, lng: () => 100.51 },
    });
    expect(onMapClick).toHaveBeenCalledWith({ lat: 13.76, lng: 100.51 });

    // Check Point A and B markers
    const markerA = createdMarkers.find((m) => m.opts?.label?.text === "A");
    const markerB = createdMarkers.find((m) => m.opts?.label?.text === "B");
    expect(markerA).toBeDefined();
    expect(markerB).toBeDefined();

    // Test dragging marker A
    expect(markerDragListeners["A"]).toBeDefined();
    markerDragListeners["A"]({
      latLng: { lat: () => 13.752, lng: () => 100.531 },
    });
    expect(onMarkerDrag).toHaveBeenCalledWith("A", {
      lat: 13.752,
      lng: 100.531,
    });

    // Check polyline
    expect(createdPolylines.length).toBe(1);

    // Check circles
    expect(createdCircles.length).toBe(2);

    // Check branches
    const branch1Marker = createdMarkers.find(
      (m) => m.opts?.label?.text === "1"
    );
    expect(branch1Marker).toBeDefined();

    // Verify InfoWindow tracking: branch1 was open
    expect(createdInfoWindows.filter((iw) => iw.isOpen).length).toBe(1);

    // Clicking marker A should close previous InfoWindow and open infoA
    markerA.listeners["click"]?.();
    const infoA = createdInfoWindows.find((iw) => iw.content.includes("Point A"));
    expect(infoA?.isOpen).toBe(true);
    expect(createdInfoWindows.filter((iw) => iw.isOpen).length).toBe(1);

    await act(async () => {
      root.unmount();
    });

    // Verify overlay cleanup on unmount
    expect(createdMarkers.every((m) => m.map === null)).toBe(true);
    expect(createdCircles.every((c) => c.map === null)).toBe(true);
    expect(createdPolylines.every((p) => p.map === null)).toBe(true);
  });

  it("clamps zoom to 15 on idle when single point is present in bounds", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    let idleHandler: Function | null = null;
    let currentZoom = 21;
    let fitBoundsCalled = false;

    const singlePointMockGoogle = {
      maps: {
        Map: class {
          center: any;
          zoom: number;
          constructor(_c: any, opts: any) {
            this.center = opts?.center;
            this.zoom = opts?.zoom;
          }
          addListener() {}
          fitBounds() {
            fitBoundsCalled = true;
          }
          getZoom() {
            return currentZoom;
          }
          setZoom(z: number) {
            currentZoom = z;
          }
        },
        Marker: class {
          setMap() {}
          addListener() {}
        },
        Polyline: class {
          setMap() {}
        },
        Circle: class {
          setMap() {}
        },
        InfoWindow: class {
          open() {}
          close() {}
        },
        LatLngBounds: class {
          extend() {}
        },
        Point: class {
          constructor(public x: number, public y: number) {}
        },
        event: {
          addListenerOnce: (_instance: any, eventName: string, handler: Function) => {
            if (eventName === "idle") idleHandler = handler;
          },
        },
      },
    };

    (window as any).google = singlePointMockGoogle;

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaValidKey"
          pointA={mockPointA}
          pointB={null}
          midpoint={null}
          branches={[]}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
        />
      );
    });

    expect(fitBoundsCalled).toBe(true);
    expect(idleHandler).not.toBeNull();
    idleHandler!();
    expect(currentZoom).toBe(15);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders 3+ person markers, polylines to centroid, and branch infowindows in GoogleMap", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const createdMarkers: any[] = [];
    const createdPolylines: any[] = [];
    const createdCircles: any[] = [];
    const createdInfoWindows: any[] = [];
    const markerDragListeners: Record<string, Function> = {};

    const mockGoogle = {
      maps: {
        Map: class {
          addListener() {}
          fitBounds() {}
        },
        Marker: class {
          opts: any;
          listeners: Record<string, Function> = {};
          constructor(opts: any) {
            this.opts = opts;
            createdMarkers.push(this);
          }
          addListener(evt: string, cb: Function) {
            this.listeners[evt] = cb;
            if (evt === "dragend") {
              if (this.opts?.personId) markerDragListeners[this.opts.personId] = cb;
            }
          }
          setMap() {}
        },
        Polyline: class {
          opts: any;
          constructor(opts: any) {
            this.opts = opts;
            createdPolylines.push(this);
          }
          setMap() {}
        },
        Circle: class {
          opts: any;
          constructor(opts: any) {
            this.opts = opts;
            createdCircles.push(this);
          }
          setMap() {}
        },
        InfoWindow: class {
          opts: any;
          content: string;
          constructor(opts: any) {
            this.opts = opts;
            this.content = opts.content;
            createdInfoWindows.push(this);
          }
          open() {}
          close() {}
        },
        LatLngBounds: class {
          extend() {}
        },
        Point: class {
          constructor(public x: number, public y: number) {}
        },
      },
    };

    (window as any).google = mockGoogle;
    const onPersonMarkerDrag = mock((_id: string, _coord: LatLng) => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaValidKey"
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={mockMidpoint}
          branches={mockMultiPersonBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onPersonMarkerDrag={onPersonMarkerDrag}
          onFallbackToOsm={() => {}}
        />
      );
    });

    // 3 person markers + 1 midpoint marker + 1 branch marker = 5 markers
    expect(createdMarkers.length).toBe(5);

    for (const person of mock3Persons) {
      const marker = createdMarkers.find(
        (m) => m.opts.position.lat === person.lat && m.opts.position.lng === person.lng
      );
      expect(marker).toBeDefined();
      expect(marker.opts.draggable).toBe(true);
      expect(marker.opts.icon.fillColor).toBe(person.color);
      expect(marker.opts.title).toContain(person.name);
    }

    // 3 polylines to centroid
    expect(createdPolylines.length).toBe(3);
    for (const person of mock3Persons) {
      const line = createdPolylines.find(
        (l) =>
          l.opts.path[0].lat === person.lat &&
          l.opts.path[0].lng === person.lng &&
          l.opts.path[1].lat === mockMidpoint.lat &&
          l.opts.path[1].lng === mockMidpoint.lng
      );
      expect(line).toBeDefined();
      expect(line.opts.strokeColor).toBe(person.color);
    }

    // Branch InfoWindow showing distances to all participants
    const branchInfoWindow = createdInfoWindows.find((iw) =>
      iw.content.includes(mockMultiPersonBranches[0].name)
    );
    expect(branchInfoWindow).toBeDefined();
    expect(branchInfoWindow.content).toContain("Alice: 0.2 km");
    expect(branchInfoWindow.content).toContain("Bob: 0.6 km");
    expect(branchInfoWindow.content).toContain("Charlie: 0.3 km");

    // Test marker drag on p1
    const p1Marker = createdMarkers.find(
      (m) => m.opts.position.lat === mock3Persons[0].lat
    );
    expect(p1Marker).toBeDefined();
    expect(markerDragListeners["p1"]).toBeDefined();
    markerDragListeners["p1"]({
      latLng: {
        lat: () => 13.747,
        lng: () => 100.535,
      },
    });
    expect(onPersonMarkerDrag).toHaveBeenCalledWith("p1", { lat: 13.747, lng: 100.535 });

    await act(async () => {
      root.unmount();
    });
  });
});

describe("Task 8: MapView Component", () => {
  beforeEach(() => {
    setupDOM();
    resetLeafletSpies();
  });

  afterEach(() => {
    if ((globalThis as any).__happyDoc) {
      (globalThis as any).document = (globalThis as any).__happyDoc;
      (globalThis as any).window = (globalThis as any).__happyWin;
    }
  });

  it("renders LeafletMap when provider is osm", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <MapView
          provider="osm"
          googleMapsApiKey="AIzaTestKey"
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
        />
      );
    });

    expect(leafletSpies.mapInstances.length).toBe(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("falls back to LeafletMap when provider is google but apiKey is empty", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <MapView
          provider="google"
          googleMapsApiKey=""
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
        />
      );
    });

    expect(leafletSpies.mapInstances.length).toBe(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders GoogleMap when provider is google and apiKey is provided", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    await act(async () => {
      root.render(
        <MapView
          provider="google"
          googleMapsApiKey="AIzaTestKeyValid"
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
        />
      );
    });

    // Script for google maps should have been injected
    const script = document.getElementById(
      "google-maps-script"
    ) as unknown as MockElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toContain("key=AIzaTestKeyValid");

    await act(async () => {
      root.unmount();
    });
  });

  it("passes multi-person props to LeafletMap when provider is osm", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onPersonMarkerDrag = mock(() => {});

    await act(async () => {
      root.render(
        <MapView
          provider="osm"
          googleMapsApiKey=""
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={mockMidpoint}
          branches={mockMultiPersonBranches}
          activePinMode={null}
          activePinPersonId="p1"
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onPersonMarkerDrag={onPersonMarkerDrag}
          onFallbackToOsm={() => {}}
        />
      );
    });

    expect(leafletSpies.mapInstances.length).toBe(1);
    // 3 person markers + 1 midpoint + 1 branch = 5 markers
    expect(leafletSpies.markers.length).toBe(5);

    await act(async () => {
      root.unmount();
    });
  });

  it("passes multi-person props to GoogleMap when provider is google and apiKey is provided", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const createdMarkers: any[] = [];
    const mockGoogle = {
      maps: {
        Map: class {
          addListener() {}
          fitBounds() {}
        },
        Marker: class {
          opts: any;
          constructor(opts: any) {
            this.opts = opts;
            createdMarkers.push(this);
          }
          addListener() {}
          setMap() {}
        },
        Polyline: class {
          setMap() {}
        },
        Circle: class {
          setMap() {}
        },
        InfoWindow: class {
          open() {}
          close() {}
        },
        LatLngBounds: class {
          extend() {}
        },
        Point: class {
          constructor(public x: number, public y: number) {}
        },
      },
    };
    (window as any).google = mockGoogle;

    await act(async () => {
      root.render(
        <MapView
          provider="google"
          googleMapsApiKey="AIzaTestKeyValid"
          persons={mock3Persons}
          pointA={null}
          pointB={null}
          midpoint={mockMidpoint}
          branches={mockMultiPersonBranches}
          activePinMode={null}
          activePinPersonId="p2"
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onPersonMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
        />
      );
    });

    // 3 person markers + 1 midpoint + 1 branch = 5 markers
    expect(createdMarkers.length).toBe(5);

    await act(async () => {
      root.unmount();
    });
  });

  it("MapView propagates onSelectBranch to map markers", () => {
    (globalThis as any).document = (globalThis as any).__happyDoc;
    (globalThis as any).window = (globalThis as any).__happyWin;
    const handleSelect = mock();
    render(
      <MapView
        provider="osm"
        midpoint={{ lat: 13.75, lng: 100.5 }}
        branches={[mockBranch1]}
        onSelectBranch={handleSelect}
      />
    );
    // Leaflet renders branch marker; clicking it triggers handleSelect
    const branchMarker = screen.getByTestId("branch-marker-1");
    fireEvent.click(branchMarker);
    expect(handleSelect).toHaveBeenCalledWith(mockBranch1);
  });

  it("LeafletMap calls onSelectBranch when branch marker is clicked", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const onSelectBranch = mock((_b: ScoredBranch) => {});

    await act(async () => {
      root.render(
        <LeafletMap
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onSelectBranch={onSelectBranch}
        />
      );
    });

    const branch1Marker = leafletSpies.markers.find((m) =>
      m.opts?.icon?.html?.includes(">1<")
    );
    expect(branch1Marker).toBeDefined();
    expect(branch1Marker.clickHandler).toBeDefined();
    branch1Marker.clickHandler();
    expect(onSelectBranch).toHaveBeenCalledWith(mockBranches[0]);

    await act(async () => {
      root.unmount();
    });
  });

  it("GoogleMap calls onSelectBranch when branch marker is clicked", async () => {
    const { doc } = setupDOM();
    const container = createMockElement("div", doc);
    const root = createRoot(container as unknown as Element);

    const createdMarkers: any[] = [];
    const markerClickListeners: Record<string, Function> = {};
    const mockGoogle = {
      maps: {
        Map: class {
          addListener() {}
          fitBounds() {}
        },
        Marker: class {
          opts: any;
          listeners: Record<string, Function> = {};
          constructor(opts: any) {
            this.opts = opts;
            createdMarkers.push(this);
          }
          addListener(evt: string, cb: Function) {
            this.listeners[evt] = cb;
            if (evt === "click" && this.opts?.label?.text === "1") {
              markerClickListeners["branch-1"] = cb;
            }
          }
          setMap() {}
        },
        Polyline: class {
          setMap() {}
        },
        Circle: class {
          setMap() {}
        },
        InfoWindow: class {
          open() {}
          close() {}
        },
        LatLngBounds: class {
          extend() {}
        },
        Point: class {
          constructor(public x: number, public y: number) {}
        },
      },
    };
    (window as any).google = mockGoogle;

    const onSelectBranch = mock((_b: ScoredBranch) => {});

    await act(async () => {
      root.render(
        <GoogleMap
          apiKey="AIzaValidKey"
          pointA={mockPointA}
          pointB={mockPointB}
          midpoint={mockMidpoint}
          branches={mockBranches}
          activePinMode={null}
          highlightedBranchId={null}
          onMapClick={() => {}}
          onMarkerDrag={() => {}}
          onFallbackToOsm={() => {}}
          onSelectBranch={onSelectBranch}
        />
      );
    });

    expect(markerClickListeners["branch-1"]).toBeDefined();
    markerClickListeners["branch-1"]();
    expect(onSelectBranch).toHaveBeenCalledWith(mockBranches[0]);

    await act(async () => {
      root.unmount();
    });
  });
});


