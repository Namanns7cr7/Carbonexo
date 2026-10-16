/**
 * Per-person CO₂ emissions by country — the Living Earth's data overlay.
 *
 * Genuine data, not decoration: extracted from Our World in Data's CO₂ dataset
 * (github.com/owid/co2-data, `co2_per_capita`, latest year available), which
 * is built on the Global Carbon Project. Territorial fossil CO₂ only — it
 * excludes land-use change and consumption-based accounting. Values are
 * tonnes per person per year, rounded to 0.1.
 *
 * Markers sit on each country's capital. That is a placement convention for a
 * national figure, not a claim about the city's emissions — the UI says so.
 *
 * To refresh: download owid-co2-data.csv, take each ISO code's latest row
 * with a non-empty co2_per_capita, and update the table and CO2_DATA_YEAR.
 */

import type { LatLon } from './geo';

export const CO2_SOURCE = {
  label: 'Our World in Data — CO₂ and Greenhouse Gas Emissions (Global Carbon Project)',
  url: 'https://github.com/owid/co2-data',
  license: 'CC BY 4.0',
  metric: 'Territorial fossil CO₂ per person (t / year)',
} as const;

export const CO2_DATA_YEAR = 2024;

/** World average, same dataset and year (OWID `emissions_total_per_capita`, World, 2024: 4.73). */
export const WORLD_CO2_PER_CAPITA = 4.7;

export interface CountryCo2 {
  iso: string;
  country: string;
  capital: string;
  /** Capital city — where the marker is placed. */
  at: LatLon;
  /** Tonnes CO₂ per person per year. */
  perCapita: number;
}

export const COUNTRY_CO2: CountryCo2[] = [
  { iso: 'USA', country: 'United States', capital: 'Washington, D.C.', at: { lat: 38.9072, lon: -77.0369 }, perCapita: 14.2 },
  { iso: 'CAN', country: 'Canada', capital: 'Ottawa', at: { lat: 45.4215, lon: -75.6972 }, perCapita: 13.4 },
  { iso: 'MEX', country: 'Mexico', capital: 'Mexico City', at: { lat: 19.4326, lon: -99.1332 }, perCapita: 3.5 },
  { iso: 'BRA', country: 'Brazil', capital: 'Brasília', at: { lat: -15.7939, lon: -47.8828 }, perCapita: 2.3 },
  { iso: 'ARG', country: 'Argentina', capital: 'Buenos Aires', at: { lat: -34.6037, lon: -58.3816 }, perCapita: 3.7 },
  { iso: 'GBR', country: 'United Kingdom', capital: 'London', at: { lat: 51.5074, lon: -0.1278 }, perCapita: 4.5 },
  { iso: 'FRA', country: 'France', capital: 'Paris', at: { lat: 48.8566, lon: 2.3522 }, perCapita: 4.0 },
  { iso: 'DEU', country: 'Germany', capital: 'Berlin', at: { lat: 52.52, lon: 13.405 }, perCapita: 6.8 },
  { iso: 'SWE', country: 'Sweden', capital: 'Stockholm', at: { lat: 59.3293, lon: 18.0686 }, perCapita: 3.6 },
  { iso: 'NOR', country: 'Norway', capital: 'Oslo', at: { lat: 59.9139, lon: 10.7522 }, perCapita: 6.7 },
  { iso: 'RUS', country: 'Russia', capital: 'Moscow', at: { lat: 55.7558, lon: 37.6173 }, perCapita: 12.3 },
  { iso: 'TUR', country: 'Türkiye', capital: 'Ankara', at: { lat: 39.9334, lon: 32.8597 }, perCapita: 5.9 },
  { iso: 'SAU', country: 'Saudi Arabia', capital: 'Riyadh', at: { lat: 24.7136, lon: 46.6753 }, perCapita: 20.4 },
  { iso: 'EGY', country: 'Egypt', capital: 'Cairo', at: { lat: 30.0444, lon: 31.2357 }, perCapita: 2.2 },
  { iso: 'NGA', country: 'Nigeria', capital: 'Abuja', at: { lat: 9.0765, lon: 7.3986 }, perCapita: 0.6 },
  { iso: 'KEN', country: 'Kenya', capital: 'Nairobi', at: { lat: -1.2921, lon: 36.8219 }, perCapita: 0.4 },
  { iso: 'ZAF', country: 'South Africa', capital: 'Pretoria', at: { lat: -25.7479, lon: 28.2293 }, perCapita: 6.9 },
  { iso: 'IND', country: 'India', capital: 'New Delhi', at: { lat: 28.6139, lon: 77.209 }, perCapita: 2.2 },
  { iso: 'CHN', country: 'China', capital: 'Beijing', at: { lat: 39.9042, lon: 116.4074 }, perCapita: 8.7 },
  { iso: 'KOR', country: 'South Korea', capital: 'Seoul', at: { lat: 37.5665, lon: 126.978 }, perCapita: 11.3 },
  { iso: 'JPN', country: 'Japan', capital: 'Tokyo', at: { lat: 35.6762, lon: 139.6503 }, perCapita: 7.8 },
  { iso: 'IDN', country: 'Indonesia', capital: 'Jakarta', at: { lat: -6.2088, lon: 106.8456 }, perCapita: 2.9 },
  { iso: 'AUS', country: 'Australia', capital: 'Canberra', at: { lat: -35.2809, lon: 149.13 }, perCapita: 14.5 },
  { iso: 'NZL', country: 'New Zealand', capital: 'Wellington', at: { lat: -41.2865, lon: 174.7762 }, perCapita: 6.2 },
];

/** 0..1 position of a value on the overlay's scale (square-root, so small emitters stay visible). */
export function co2Intensity(perCapita: number, max = Math.max(...COUNTRY_CO2.map((c) => c.perCapita))): number {
  if (max <= 0) return 0;
  return Math.sqrt(Math.max(0, Math.min(perCapita, max)) / max);
}

/**
 * Marker colour for a value: cyan (low) → mint → warm amber (high).
 * Restrained on purpose — the overlay sits on a photographic planet.
 */
export function co2Color(intensity: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [95, 211, 232]],
    [0.5, [184, 232, 212]],
    [1, [245, 170, 80]],
  ];
  const t = Math.max(0, Math.min(1, intensity));
  const i = t <= 0.5 ? 0 : 1;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const k = (t - t0) / (t1 - t0);
  const mix = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}
