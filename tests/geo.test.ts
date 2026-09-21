import { describe, expect, it } from "bun:test";
import {
  computeMidpoint,
  haversineDistance,
  computeFairnessScore,
  scoreAndRankBranches,
  computeCentroid,
  computeMultiPersonFairness,
  scoreAndRankBranchesMulti,
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

describe("Multi-Person Geographic Math & Scoring", () => {
  const p1 = { id: "1", name: "Alice", lat: 13.7563, lng: 100.5018 };
  const p2 = { id: "2", name: "Bob", lat: 13.7223, lng: 100.5284 };
  const p3 = { id: "3", name: "Charlie", lat: 13.7383, lng: 100.5604 };

  it("computes centroid midpoint accurately for 3+ people", () => {
    const centroid = computeCentroid([p1, p2, p3]);
    expect(centroid.lat).toBeCloseTo((p1.lat + p2.lat + p3.lat) / 3, 4);
    expect(centroid.lng).toBeCloseTo((p1.lng + p2.lng + p3.lng) / 3, 4);
  });

  it("computes multi-person fairness score matching 2-person formula for N=2", () => {
    // 2 people: dist1 = 2, dist2 = 4 -> sum = 6, spread = 2 -> score = 6 + 2*(2) = 10
    const result2 = computeMultiPersonFairness([2, 4]);
    expect(result2.fairnessScore).toBe(10);
    expect(result2.spread).toBe(2);

    // 3 people: dist1 = 2, dist2 = 3, dist3 = 5 -> sum = 10, spread = 5 - 2 = 3 -> score = 10 + 2*(3) = 16
    const result3 = computeMultiPersonFairness([2, 3, 5]);
    expect(result3.fairnessScore).toBe(16);
    expect(result3.spread).toBe(3);
  });

  it("scores and ranks branches for multi-person groups", () => {
    const candidates = [
      { id: "c1", name: "Branch Centered", address: "Center", lat: 13.739, lng: 100.53 },
      { id: "c2", name: "Branch Outlier", address: "Far", lat: 13.9, lng: 100.7 },
    ];
    const scored = scoreAndRankBranchesMulti([p1, p2, p3], candidates, 5.0);
    expect(scored.length).toBe(2);
    expect(scored[0].id).toBe("c1");
    expect(scored[0].distances.length).toBe(3);
    expect(scored[0].fairnessScore).toBeLessThan(scored[1].fairnessScore);
  });
});
