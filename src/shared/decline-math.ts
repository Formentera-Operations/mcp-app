// Arps decline curve formulas for O&G production forecasting

export type DeclineMethod = 'exponential' | 'hyperbolic' | 'harmonic';

export interface DeclineParams {
  method: DeclineMethod;
  ip: number;    // initial production rate (BBL/D)
  di: number;    // initial decline rate (fraction/month)
  b: number;     // hyperbolic exponent (0=exp, 0<b<1=hyp, 1=harmonic)
  months: number; // forecast duration
}

/** Calculate production rate at time t (months) using Arps equations */
export function arpsRate(params: DeclineParams, t: number): number {
  const { ip } = params;
  // Clamp b to valid range [0, 2] and di to (0, 1] to prevent divergent forecasts
  const b = Math.max(0, Math.min(2, params.b));
  const di = Math.min(Math.max(params.di, 0), 1);
  if (t < 0 || ip <= 0 || di <= 0) return 0;

  if (b === 0 || params.method === 'exponential') {
    // Exponential: q(t) = qi * e^(-di*t)
    return ip * Math.exp(-di * t);
  }

  if (b === 1 || params.method === 'harmonic') {
    // Harmonic: q(t) = qi / (1 + di*t)
    return ip / (1 + di * t);
  }

  // Hyperbolic: q(t) = qi * (1 + b*di*t)^(-1/b)
  const base = 1 + b * di * t;
  if (base <= 0) return 0;
  return ip * Math.pow(base, -1 / b);
}

/** Generate monthly forecast series */
export function generateForecast(params: DeclineParams): number[] {
  const rates: number[] = [];
  for (let t = 0; t <= params.months; t++) {
    rates.push(arpsRate(params, t));
  }
  return rates;
}

/** Estimate EUR (Estimated Ultimate Recovery) via trapezoidal integration */
export function calculateEur(params: DeclineParams): number {
  let eur = 0;
  const dt = 1; // month
  for (let t = 0; t < params.months; t++) {
    const q0 = arpsRate(params, t);
    const q1 = arpsRate(params, t + dt);
    eur += (q0 + q1) / 2 * 30.44; // avg days per month
  }
  return eur;
}

/** Simple least-squares exponential fit from actual production data */
export function fitExponential(rates: number[]): { ip: number; di: number } | null {
  // Filter out zeros and nulls
  const valid = rates.filter((r) => r > 0);
  if (valid.length < 3) return null;

  // Exponential fit: ln(q) = ln(qi) - di*t
  const n = valid.length;
  let sumT = 0, sumLnQ = 0, sumTLnQ = 0, sumT2 = 0;
  for (let i = 0; i < n; i++) {
    const lnQ = Math.log(valid[i]);
    sumT += i;
    sumLnQ += lnQ;
    sumTLnQ += i * lnQ;
    sumT2 += i * i;
  }

  const denom = n * sumT2 - sumT * sumT;
  if (Math.abs(denom) < 1e-10) return null;

  const di = -(n * sumTLnQ - sumT * sumLnQ) / denom;
  const lnIp = (sumLnQ - (-di) * sumT) / n;
  const ip = Math.exp(lnIp);

  if (di <= 0 || ip <= 0 || !isFinite(di) || !isFinite(ip)) return null;
  return { ip, di };
}
