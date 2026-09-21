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

export interface ScoredBranch extends BranchCandidate {
  distA: number;
  distB: number;
  distMid: number;
  fairnessScore: number;
  fairnessDelta: number;
  tier: "primary" | "extended";
  googleMapsUrl: string;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function computeMidpoint(a: LatLng, b: LatLng): LatLng {
  return {
    lat: Number(((a.lat + b.lat) / 2).toFixed(6)),
    lng: Number(((a.lng + b.lng) / 2).toFixed(6)),
  };
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

export function computeFairnessScore(distA: number, distB: number): number {
  const sum = distA + distB;
  const delta = Math.abs(distA - distB);
  return Number((sum + 2 * delta).toFixed(2));
}

export function scoreAndRankBranches(
  pointA: LatLng,
  pointB: LatLng,
  branches: BranchCandidate[],
  primaryRadiusKm: number = 3.0
): ScoredBranch[] {
  const midpoint = computeMidpoint(pointA, pointB);

  const scored: ScoredBranch[] = branches.map((branch) => {
    const branchCoord = { lat: branch.lat, lng: branch.lng };
    const distA = haversineDistance(pointA, branchCoord);
    const distB = haversineDistance(pointB, branchCoord);
    const distMid = haversineDistance(midpoint, branchCoord);
    const fairnessScore = computeFairnessScore(distA, distB);
    const fairnessDelta = Number(Math.abs(distA - distB).toFixed(2));
    const tier = distMid <= primaryRadiusKm ? "primary" : "extended";

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pointA.lat},${pointA.lng}&destination=${branch.lat},${branch.lng}`;

    return {
      ...branch,
      distA,
      distB,
      distMid,
      fairnessScore,
      fairnessDelta,
      tier,
      googleMapsUrl,
    };
  });

  return scored.sort((a, b) => a.fairnessScore - b.fairnessScore);
}
