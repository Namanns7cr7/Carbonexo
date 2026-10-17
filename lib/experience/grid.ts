/**
 * Carbon intensity of electricity by country — the Living Earth's grid layer.
 *
 * Extracted from Our World in Data's "Lifecycle carbon intensity of
 * electricity" (ourworldindata.org/grapher/carbon-intensity-electricity),
 * which is built on Ember's Yearly Electricity Data. Lifecycle basis,
 * all greenhouse gases, grams CO₂e per kWh *generated*. Latest year per
 * country as published (dataset updated 2026-06-30). Rounded to whole grams.
 *
 * This is the national annual average. A household's actual intensity varies
 * by hour, region and supplier; the UI says so.
 *
 * To refresh: download the grapher CSV, take each ISO code's latest row, and
 * update the table. Countries match COUNTRY_CO2 so markers share positions.
 */

export const GRID_SOURCE = {
  label: 'Ember via Our World in Data — Lifecycle carbon intensity of electricity',
  url: 'https://ourworldindata.org/grapher/carbon-intensity-electricity',
  license: 'CC BY 4.0',
  metric: 'g CO₂e per kWh generated (national annual average, lifecycle)',
} as const;

export interface GridIntensity {
  /** g CO₂e / kWh. */
  g: number;
  year: number;
}

export const GRID_INTENSITY: Record<string, GridIntensity> = {
  USA: { g: 384, year: 2025 },
  CAN: { g: 191, year: 2025 },
  MEX: { g: 474, year: 2025 },
  BRA: { g: 110, year: 2025 },
  ARG: { g: 346, year: 2025 },
  GBR: { g: 217, year: 2025 },
  FRA: { g: 41, year: 2025 },
  DEU: { g: 330, year: 2025 },
  SWE: { g: 35, year: 2025 },
  NOR: { g: 28, year: 2025 },
  RUS: { g: 450, year: 2025 },
  TUR: { g: 475, year: 2025 },
  SAU: { g: 692, year: 2024 },
  EGY: { g: 563, year: 2025 },
  NGA: { g: 456, year: 2025 },
  KEN: { g: 95, year: 2025 },
  ZAF: { g: 699, year: 2025 },
  IND: { g: 670, year: 2025 },
  CHN: { g: 525, year: 2025 },
  KOR: { g: 417, year: 2025 },
  JPN: { g: 477, year: 2025 },
  IDN: { g: 680, year: 2024 },
  AUS: { g: 525, year: 2025 },
  NZL: { g: 93, year: 2025 },
};

export const WORLD_GRID: GridIntensity = { g: 458, year: 2025 };

/** 0 (cleanest) … 1 (dirtiest), on a fixed 0–750 g scale so colours are comparable across sessions. */
export function gridIntensity01(g: number): number {
  return Math.max(0, Math.min(1, g / 750));
}

/** Clean grid reads as ocean-teal, coal-heavy as ember. Same perceptual ramp family as the CO₂ layer. */
export function gridColor(t: number): string {
  // teal (#5fd4c4) → sand (#e9c46a) → ember (#e76f51)
  const stops: [number, number, number][] = [
    [95, 212, 196],
    [233, 196, 106],
    [231, 111, 81],
  ];
  const x = Math.max(0, Math.min(1, t)) * 2;
  const i = Math.min(1, Math.floor(x));
  const f = x - i;
  const [a, b] = [stops[i], stops[i + 1]];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Emissions for running a device: kWh × g/kWh → kg. */
export function kgForKwh(kwh: number, gPerKwh: number): number {
  return (kwh * gPerKwh) / 1000;
}
