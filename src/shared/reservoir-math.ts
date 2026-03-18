// Reservoir engineering math utilities

/**
 * A 2D point used for curve intersection calculations.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Find the intersection of two polylines (arrays of 2D points).
 * Checks every pair of line segments for intersection.
 * Returns the first intersection found, or null if curves don't cross.
 *
 * Used for VLP/IPR operating point calculation when the server
 * doesn't return a pre-computed intersection.
 */
export function findCurveIntersection(
  curve1: Point2D[],
  curve2: Point2D[],
): Point2D | null {
  for (let i = 0; i < curve1.length - 1; i++) {
    for (let j = 0; j < curve2.length - 1; j++) {
      const pt = segmentIntersection(
        curve1[i], curve1[i + 1],
        curve2[j], curve2[j + 1],
      );
      if (pt) return pt;
    }
  }
  return null;
}

/**
 * Find intersection of two line segments (p1-p2) and (p3-p4).
 * Returns the intersection point or null if segments don't cross.
 */
function segmentIntersection(
  p1: Point2D, p2: Point2D,
  p3: Point2D, p4: Point2D,
): Point2D | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // Parallel or coincident

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  // Check both parameters are within [0, 1] (intersection within segments)
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y,
  };
}
