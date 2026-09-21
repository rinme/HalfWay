import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import Home from "@/app/page";

describe("Mobile Layout Integration", () => {
  const originalFetch = globalThis.fetch;
  const originalLocationSearch = window.location.search;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    window.location.search = originalLocationSearch;
  });

  it("renders floating view switcher toggle on page", () => {
    render(<Home />);
    const toggleBtn = screen.getByRole("button", { name: /view map/i });
    expect(toggleBtn).toBeDefined();
  });

  it("toggles mobile view between list and map", () => {
    render(<Home />);
    const toggleBtn = screen.getByRole("button", { name: /view map/i });
    fireEvent.click(toggleBtn);

    // Now button should display View Results
    expect(screen.getByRole("button", { name: /view results/i })).toBeDefined();
  });

  it("auto-switches to map view and displays pinning banner when pin mode is activated", () => {
    render(<Home />);
    // Click pin button for Person 1
    const pinButtons = screen.getAllByTitle(/pin.*on map/i);
    fireEvent.click(pinButtons[0]);

    // Should display pinning banner with Person 1's name
    expect(screen.getByText(/Tap map to place location for/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /done/i })).toBeDefined();

    // Clicking Done closes pinning banner
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.queryByText(/Tap map to place location for/i)).toBeNull();
  });

  it("applies dynamic viewport height h-[100dvh] to the root container", () => {
    const { container } = render(<Home />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("h-[100dvh]");
  });

  it("handles search submission: collapses search into MobileSearchSummary, switches to map view, and expands on demand", async () => {
    window.location.search =
      "?a_lat=13.746&a_lng=100.534&a_name=Siam+Paragon&b_lat=13.744&b_lng=100.539&b_name=CentralWorld&q=Starbucks";

    const mockBranch = {
      id: "branch-1",
      name: "Starbucks Siam Paragon",
      address: "Rama I Rd",
      lat: 13.746,
      lng: 100.534,
      googleMapsUrl: "https://maps.google.com/?cid=1",
      fairnessScore: 1.2,
      spread: 0.2,
      distMid: 0.1,
      tier: "primary" as const,
      distances: [
        { personId: "person-1", name: "Siam Paragon", distance: 1.0 },
        { personId: "person-2", name: "CentralWorld", distance: 1.2 },
      ],
    };

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/search-midpoint")) {
        return new Response(
          JSON.stringify({
            success: true,
            branches: [mockBranch],
            midpoint: { lat: 13.745, lng: 100.535 },
            totalDistanceAB: 2.2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    render(<Home />);

    // Click Find Midpoint Branches button
    const searchBtn = screen.getByRole("button", { name: /find (fair )?midpoint/i });
    fireEvent.click(searchBtn);

    // Wait for search to complete and verify MobileSearchSummary is shown
    await waitFor(() => {
      expect(screen.getByText(/2 People/i)).toBeDefined();
    });

    // In map view, toggle button should say "View Results (1)"
    expect(screen.getByRole("button", { name: /view results \(1\)/i })).toBeDefined();

    // Clicking Edit in MobileSearchSummary should expand SearchForm
    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);

    // SearchForm is restored
    expect(screen.getByRole("button", { name: /find (fair )?midpoint/i })).toBeDefined();
  });

  it("displays MobileBranchPreview when a branch is selected in map view and switches to list view on View Details", async () => {
    window.location.search =
      "?a_lat=13.746&a_lng=100.534&a_name=Siam+Paragon&b_lat=13.744&b_lng=100.539&b_name=CentralWorld&q=Starbucks";

    const mockBranch = {
      id: "branch-test",
      name: "Roast Coffee CentralWorld",
      address: "999/9 Rama I Rd",
      lat: 13.7445,
      lng: 100.539,
      googleMapsUrl: "https://maps.google.com/?cid=roast",
      fairnessScore: 0.8,
      spread: 0.1,
      distMid: 0.2,
      tier: "primary" as const,
      distances: [
        { personId: "person-1", name: "Siam Paragon", distance: 1.1 },
        { personId: "person-2", name: "CentralWorld", distance: 1.0 },
      ],
    };

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/search-midpoint")) {
        return new Response(
          JSON.stringify({
            success: true,
            branches: [mockBranch],
            midpoint: { lat: 13.745, lng: 100.535 },
            totalDistanceAB: 2.1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    render(<Home />);

    // Submit search
    const searchBtn = screen.getByRole("button", { name: /find (fair )?midpoint/i });
    fireEvent.click(searchBtn);

    // Wait for search completion (auto-switches to map view)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view results \(1\)/i })).toBeDefined();
    });

    // Switch to list view to hover a branch card
    fireEvent.click(screen.getByRole("button", { name: /view results \(1\)/i }));
    expect(screen.getByText("Roast Coffee CentralWorld")).toBeDefined();

    // Hover over the branch card to select it
    const branchItem = screen.getByText("Roast Coffee CentralWorld");
    fireEvent.mouseEnter(branchItem);

    // Switch to map view
    fireEvent.click(screen.getByRole("button", { name: /view map/i }));

    // MobileBranchPreview should be visible (there's one in ResultsList and one in MobileBranchPreview)
    expect(screen.getAllByText("Roast Coffee CentralWorld").length).toBe(2);
    expect(screen.getByRole("button", { name: /^details$/i })).toBeDefined();

    // Clicking Details navigates to list view
    fireEvent.click(screen.getByRole("button", { name: /^details$/i }));
    expect(screen.getByRole("button", { name: /view map/i })).toBeDefined();

    // Switch back to map view and test Close button
    fireEvent.click(screen.getByRole("button", { name: /view map/i }));
    const closeBtn = screen.getByRole("button", { name: /^close$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("button", { name: /^details$/i })).toBeNull();
    // After closing, only the 1 element in ResultsList remains
    expect(screen.getAllByText("Roast Coffee CentralWorld").length).toBe(1);
  });
});
