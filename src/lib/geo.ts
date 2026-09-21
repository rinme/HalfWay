export interface LatLng {
  lat: number;
  lng: number;
}

export interface BranchCandidate {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PersonCoord {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface PersonDistance {
  personId: string;
  name: string;
  distance: number;
}

export interface ScoredBranch extends BranchCandidate {
  distances: PersonDistance[];
  distA?: number; // Backward compatibility
  distB?: number; // Backward compatibility
  distMid: number;
  fairnessScore: number;
  spread: number;
  fairnessDelta?: number; // Backward compatibility
  tier: "primary" | "extended";
  googleMapsUrl: string;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function computeCentroid(coords: LatLng[]): LatLng {
  if (coords.length === 0) {
    return { lat: 0, lng: 0 };
  }
  const sumLat = coords.reduce((sum, c) => sum + c.lat, 0);
  const sumLng = coords.reduce((sum, c) => sum + c.lng, 0);
  return {
    lat: Number((sumLat / coords.length).toFixed(6)),
    lng: Number((sumLng / coords.length).toFixed(6)),
  };
}

export function computeMidpoint(a: LatLng, b: LatLng): LatLng {
  return computeCentroid([a, b]);
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  if (a.lat === b.lat && a.lng === b.lng) {
    return 0;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

export function computeMultiPersonFairness(distances: number[]): {
  fairnessScore: number;
  spread: number;
} {
  if (distances.length === 0) {
    return { fairnessScore: 0, spread: 0 };
  }
  const sum = distances.reduce((acc, d) => acc + d, 0);
  const max = Math.max(...distances);
  const min = Math.min(...distances);
  const spread = Number((max - min).toFixed(2));
  const fairnessScore = Number((sum + 2 * (max - min)).toFixed(2));
  return { fairnessScore, spread };
}

export function computeFairnessScore(distA: number, distB: number): number {
  return computeMultiPersonFairness([distA, distB]).fairnessScore;
}

export function scoreAndRankBranchesMulti(
  persons: PersonCoord[],
  branches: BranchCandidate[],
  primaryRadiusKm: number = 3.0
): ScoredBranch[] {
  const centroid = computeCentroid(persons);

  const scored: ScoredBranch[] = branches.map((branch) => {
    const branchCoord = { lat: branch.lat, lng: branch.lng };
    const distances: PersonDistance[] = persons.map((p) => ({
      personId: p.id,
      name: p.name,
      distance: haversineDistance({ lat: p.lat, lng: p.lng }, branchCoord),
    }));

    const distValues = distances.map((d) => d.distance);
    const { fairnessScore, spread } = computeMultiPersonFairness(distValues);
    const distMid = haversineDistance(centroid, branchCoord);
    const tier: "primary" | "extended" = distMid <= primaryRadiusKm ? "primary" : "extended";

    const originLat = persons.length > 0 ? persons[0].lat : centroid.lat;
    const originLng = persons.length > 0 ? persons[0].lng : centroid.lng;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${branch.lat},${branch.lng}`;

    return {
      ...branch,
      distances,
      distA: distances[0]?.distance,
      distB: distances[1]?.distance,
      distMid,
      fairnessScore,
      spread,
      fairnessDelta: spread,
      tier,
      googleMapsUrl,
    };
  });

  return scored.sort((a, b) => a.fairnessScore - b.fairnessScore);
}

export function scoreAndRankBranches(
  pointA: LatLng,
  pointB: LatLng,
  branches: BranchCandidate[],
  primaryRadiusKm: number = 3.0
): ScoredBranch[] {
  const persons: PersonCoord[] = [
    { id: "person-a", name: "Person A", lat: pointA.lat, lng: pointA.lng },
    { id: "person-b", name: "Person B", lat: pointB.lat, lng: pointB.lng },
  ];
  return scoreAndRankBranchesMulti(persons, branches, primaryRadiusKm);
}
