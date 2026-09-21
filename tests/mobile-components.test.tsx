import { describe, it, expect, mock } from "bun:test";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFloatingToggle } from "@/components/mobile/MobileFloatingToggle";
import { MobileSearchSummary } from "@/components/mobile/MobileSearchSummary";
import { MobileBranchPreview } from "@/components/mobile/MobileBranchPreview";
import { MobilePinningBanner } from "@/components/mobile/MobilePinningBanner";
import { Person, ScoredBranch } from "@/types";

describe("Mobile Subcomponents", () => {
  const mockPersons: Person[] = [
    { id: "1", name: "Alice", address: "Siam Paragon", lat: 13.7462, lng: 100.5347, color: "#10b981" },
    { id: "2", name: "Bob", address: "CentralWorld", lat: 13.7469, lng: 100.5398, color: "#8b5cf6" },
  ];

  const mockBranch: ScoredBranch = {
    id: "b1",
    name: "Starbucks Central Chidlom",
    lat: 13.744,
    lng: 100.543,
    address: "Ploenchit Rd",
    googleMapsUrl: "https://maps.google.com/?cid=123",
    fairnessScore: 4.2,
    spread: 0.4,
    distMid: 0.3,
    tier: "primary",
    distances: [
      { personId: "1", name: "Alice", distance: 2.1 },
      { personId: "2", name: "Bob", distance: 2.5 },
    ],
  };

  it("MobileFloatingToggle displays 'View Map' when in list view and triggers toggle", () => {
    const handleToggle = mock();
    render(<MobileFloatingToggle activeView="list" onToggle={handleToggle} resultCount={5} />);

    const button = screen.getByRole("button", { name: /view map/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith("map");
  });

  it("MobileFloatingToggle displays 'View Results (5)' when in map view and triggers toggle", () => {
    const handleToggle = mock();
    render(<MobileFloatingToggle activeView="map" onToggle={handleToggle} resultCount={5} />);

    const button = screen.getByRole("button", { name: /view results \(5\)/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith("list");
  });

  it("MobileSearchSummary displays participant count, brand chip, and triggers onExpand", () => {
    const handleExpand = mock();
    render(<MobileSearchSummary persons={mockPersons} query="Starbucks" onExpand={handleExpand} />);

    expect(screen.getByText(/2 People/i)).toBeDefined();
    expect(screen.getByText(/Starbucks/i)).toBeDefined();
    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);
    expect(handleExpand).toHaveBeenCalled();
  });

  it("MobileBranchPreview displays branch info, spread, individual distances, and links", () => {
    const handleClose = mock();
    render(<MobileBranchPreview branch={mockBranch} onClose={handleClose} />);

    expect(screen.getByText("Starbucks Central Chidlom")).toBeDefined();
    expect(screen.getByText(/±0.4 km/i)).toBeDefined();
    expect(screen.getByText(/Alice: 2.1 km/i)).toBeDefined();
    expect(screen.getByText(/Bob: 2.5 km/i)).toBeDefined();

    const mapsLink = screen.getByRole("link", { name: /open in google maps/i });
    expect(mapsLink.getAttribute("href")).toBe(mockBranch.googleMapsUrl);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it("MobilePinningBanner displays active person name and triggers onDone", () => {
    const handleDone = mock();
    render(<MobilePinningBanner activePerson={mockPersons[0]} onDone={handleDone} />);

    expect(screen.getByText(/Tap map to place location for Alice/i)).toBeDefined();
    const doneBtn = screen.getByRole("button", { name: /done/i });
    fireEvent.click(doneBtn);
    expect(handleDone).toHaveBeenCalled();
  });
});
