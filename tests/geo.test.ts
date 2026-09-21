import { describe, expect, it } from "bun:test";
import {
  computeMidpoint,
  haversineDistance,
  computeFairnessScore,
  scoreAndRankBranches,
} from "../src/lib/geo";

describe("Geographic Math & Scoring", () => {
  const pointA = { lat: 13.7563, lng: 100.5018 }; // Bangkok Old City
  const pointB = { lat: 13.7223, lng: 100.5284 }; // Silom

  it("calculates correct midpoint between two coordinates", () => {
    const mid = computeMidpoint(pointA, pointB);
    expect(mid.lat).toBeCloseTo(13.7393, 3);
    expect(mid.lng).toBeCloseTo(100.5151, 3);
  });

  it("calculates haversine distance accurately in kilometers", () => {
    // Bangkok Old City to Silom is approx 4.7 - 4.9 km
    const dist = haversineDistance(pointA, pointB);
    expect(dist).toBeGreaterThan(4.5);
    expect(dist).toBeLessThan(5.1);
  });

  it("returns 0 distance for identical coordinates", () => {
    const dist = haversineDistance(pointA, pointA);
    expect(dist).toBe(0);
  });

  it("computes fairness score with double penalty on difference", () => {
    // Score = (distA + distB) + 2 * |distA - distB|
    // Case 1: distA = 2, distB = 2 -> (2+2) + 2*(0) = 4
    expect(computeFairnessScore(2, 2)).toBe(4);
    // Case 2: distA = 1, distB = 3 -> (1+3) + 2*(2) = 8
    expect(computeFairnessScore(1, 3)).toBe(8);
  });

  it("scores, tags tiers, and ranks branches by fairness score ascending", () => {
    const mid = computeMidpoint(pointA, pointB);
    const candidates = [
      {
        id: "unfair",
        name: "Branch Unfair",
        address: "Near A",
        lat: pointA.lat,
        lng: pointA.lng, // distA ≈ 0, distB ≈ 4.8, fairness = 4.8 + 2*(4.8) = 14.4
      },
      {
        id: "fair",
        name: "Branch Fair",
        address: "At Midpoint",
        lat: mid.lat,
        lng: mid.lng, // distA ≈ 2.4, distB ≈ 2.4, fairness ≈ 4.8
      },
    ];

    const ranked = scoreAndRankBranches(pointA, pointB, candidates, 3.0);
    expect(ranked.length).toBe(2);
    expect(ranked[0].id).toBe("fair");
    expect(ranked[1].id).toBe("unfair");
    expect(ranked[0].fairnessScore).toBeLessThan(ranked[1].fairnessScore);
    expect(ranked[0].tier).toBe("primary");
    expect(ranked[0].googleMapsUrl).toContain("maps/dir");
  });
});
