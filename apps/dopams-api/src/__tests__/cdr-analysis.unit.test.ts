import { describe, it, expect } from "vitest";

/**
 * Re-implementation of the private haversineKm function from ../services/cdr-analysis.ts
 * Calculates great-circle distance between two lat/lng points using the Haversine formula.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe("haversineKm", () => {
  it("same point returns 0", () => {
    expect(haversineKm(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
  });

  it("Delhi to Mumbai ≈ 1153 km", () => {
    const dist = haversineKm(28.6139, 77.209, 19.076, 72.8777);
    expect(dist).toBeGreaterThan(1153 - 50);
    expect(dist).toBeLessThan(1153 + 50);
  });

  it("London to Paris ≈ 344 km", () => {
    const dist = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(344 - 20);
    expect(dist).toBeLessThan(344 + 20);
  });

  it("antipodal points (0,0) to (0,180) ≈ 20015 km (half circumference)", () => {
    const dist = haversineKm(0, 0, 0, 180);
    expect(dist).toBeGreaterThan(20015 - 100);
    expect(dist).toBeLessThan(20015 + 100);
  });
});
