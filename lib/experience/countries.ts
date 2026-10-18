/**
 * Major countries for the journey planner: each one's capital (where a trip
 * starts or ends, the same placement convention as co2.ts) and the landmass it
 * sits on, which decides whether a road or rail trip between two of them is
 * even possible. Coordinates are the capital cities' real positions.
 *
 * `land` groups countries that are joined by land: 'eurasia-africa', 'north-america'
 * and 'south-america'. Island nations and anywhere only reachable across water
 * (Japan, the UK, Australia, ...) carry their own ISO code, so no two of them
 * ever share a landmass and every trip to or from them is a flight.
 */

import type { LatLon } from './geo';

export interface JourneyCountry {
  iso: string;
  name: string;
  capital: string;
  at: LatLon;
  land: string;
}

const EA = 'eurasia-africa';
const NA = 'north-america';
const SA = 'south-america';

export const JOURNEY_COUNTRIES: JourneyCountry[] = [
  // Asia
  { iso: 'AFG', name: 'Afghanistan', capital: 'Kabul', at: { lat: 34.5553, lon: 69.2075 }, land: EA },
  { iso: 'BGD', name: 'Bangladesh', capital: 'Dhaka', at: { lat: 23.8103, lon: 90.4125 }, land: EA },
  { iso: 'KHM', name: 'Cambodia', capital: 'Phnom Penh', at: { lat: 11.5564, lon: 104.9282 }, land: EA },
  { iso: 'CHN', name: 'China', capital: 'Beijing', at: { lat: 39.9042, lon: 116.4074 }, land: EA },
  { iso: 'IND', name: 'India', capital: 'New Delhi', at: { lat: 28.6139, lon: 77.209 }, land: EA },
  { iso: 'IDN', name: 'Indonesia', capital: 'Jakarta', at: { lat: -6.2088, lon: 106.8456 }, land: 'IDN' },
  { iso: 'IRN', name: 'Iran', capital: 'Tehran', at: { lat: 35.6892, lon: 51.389 }, land: EA },
  { iso: 'IRQ', name: 'Iraq', capital: 'Baghdad', at: { lat: 33.3152, lon: 44.3661 }, land: EA },
  { iso: 'ISR', name: 'Israel', capital: 'Jerusalem', at: { lat: 31.7683, lon: 35.2137 }, land: EA },
  { iso: 'JPN', name: 'Japan', capital: 'Tokyo', at: { lat: 35.6762, lon: 139.6503 }, land: 'JPN' },
  { iso: 'JOR', name: 'Jordan', capital: 'Amman', at: { lat: 31.9454, lon: 35.9284 }, land: EA },
  { iso: 'KAZ', name: 'Kazakhstan', capital: 'Astana', at: { lat: 51.1694, lon: 71.4491 }, land: EA },
  { iso: 'LAO', name: 'Laos', capital: 'Vientiane', at: { lat: 17.9757, lon: 102.6331 }, land: EA },
  { iso: 'MYS', name: 'Malaysia', capital: 'Kuala Lumpur', at: { lat: 3.139, lon: 101.6869 }, land: EA },
  { iso: 'MNG', name: 'Mongolia', capital: 'Ulaanbaatar', at: { lat: 47.8864, lon: 106.9057 }, land: EA },
  { iso: 'MMR', name: 'Myanmar', capital: 'Naypyidaw', at: { lat: 19.7633, lon: 96.0785 }, land: EA },
  { iso: 'NPL', name: 'Nepal', capital: 'Kathmandu', at: { lat: 27.7172, lon: 85.324 }, land: EA },
  { iso: 'PAK', name: 'Pakistan', capital: 'Islamabad', at: { lat: 33.6844, lon: 73.0479 }, land: EA },
  { iso: 'PHL', name: 'Philippines', capital: 'Manila', at: { lat: 14.5995, lon: 120.9842 }, land: 'PHL' },
  { iso: 'QAT', name: 'Qatar', capital: 'Doha', at: { lat: 25.2854, lon: 51.531 }, land: EA },
  { iso: 'SAU', name: 'Saudi Arabia', capital: 'Riyadh', at: { lat: 24.7136, lon: 46.6753 }, land: EA },
  { iso: 'SGP', name: 'Singapore', capital: 'Singapore', at: { lat: 1.3521, lon: 103.8198 }, land: EA },
  { iso: 'KOR', name: 'South Korea', capital: 'Seoul', at: { lat: 37.5665, lon: 126.978 }, land: 'KOR' },
  { iso: 'LKA', name: 'Sri Lanka', capital: 'Colombo', at: { lat: 6.9271, lon: 79.8612 }, land: 'LKA' },
  { iso: 'TWN', name: 'Taiwan', capital: 'Taipei', at: { lat: 25.033, lon: 121.5654 }, land: 'TWN' },
  { iso: 'THA', name: 'Thailand', capital: 'Bangkok', at: { lat: 13.7563, lon: 100.5018 }, land: EA },
  { iso: 'TUR', name: 'Türkiye', capital: 'Ankara', at: { lat: 39.9334, lon: 32.8597 }, land: EA },
  { iso: 'ARE', name: 'United Arab Emirates', capital: 'Abu Dhabi', at: { lat: 24.4539, lon: 54.3773 }, land: EA },
  { iso: 'UZB', name: 'Uzbekistan', capital: 'Tashkent', at: { lat: 41.2995, lon: 69.2401 }, land: EA },
  { iso: 'VNM', name: 'Vietnam', capital: 'Hanoi', at: { lat: 21.0285, lon: 105.8542 }, land: EA },
  // Europe
  { iso: 'AUT', name: 'Austria', capital: 'Vienna', at: { lat: 48.2082, lon: 16.3738 }, land: EA },
  { iso: 'BEL', name: 'Belgium', capital: 'Brussels', at: { lat: 50.8503, lon: 4.3517 }, land: EA },
  { iso: 'CZE', name: 'Czechia', capital: 'Prague', at: { lat: 50.0755, lon: 14.4378 }, land: EA },
  { iso: 'DNK', name: 'Denmark', capital: 'Copenhagen', at: { lat: 55.6761, lon: 12.5683 }, land: EA },
  { iso: 'FIN', name: 'Finland', capital: 'Helsinki', at: { lat: 60.1699, lon: 24.9384 }, land: EA },
  { iso: 'FRA', name: 'France', capital: 'Paris', at: { lat: 48.8566, lon: 2.3522 }, land: EA },
  { iso: 'DEU', name: 'Germany', capital: 'Berlin', at: { lat: 52.52, lon: 13.405 }, land: EA },
  { iso: 'GRC', name: 'Greece', capital: 'Athens', at: { lat: 37.9838, lon: 23.7275 }, land: EA },
  { iso: 'HUN', name: 'Hungary', capital: 'Budapest', at: { lat: 47.4979, lon: 19.0402 }, land: EA },
  { iso: 'ISL', name: 'Iceland', capital: 'Reykjavik', at: { lat: 64.1466, lon: -21.9426 }, land: 'ISL' },
  { iso: 'IRL', name: 'Ireland', capital: 'Dublin', at: { lat: 53.3498, lon: -6.2603 }, land: 'IRL' },
  { iso: 'ITA', name: 'Italy', capital: 'Rome', at: { lat: 41.9028, lon: 12.4964 }, land: EA },
  { iso: 'NLD', name: 'Netherlands', capital: 'Amsterdam', at: { lat: 52.3676, lon: 4.9041 }, land: EA },
  { iso: 'NOR', name: 'Norway', capital: 'Oslo', at: { lat: 59.9139, lon: 10.7522 }, land: EA },
  { iso: 'POL', name: 'Poland', capital: 'Warsaw', at: { lat: 52.2297, lon: 21.0122 }, land: EA },
  { iso: 'PRT', name: 'Portugal', capital: 'Lisbon', at: { lat: 38.7223, lon: -9.1393 }, land: EA },
  { iso: 'ROU', name: 'Romania', capital: 'Bucharest', at: { lat: 44.4268, lon: 26.1025 }, land: EA },
  { iso: 'RUS', name: 'Russia', capital: 'Moscow', at: { lat: 55.7558, lon: 37.6173 }, land: EA },
  { iso: 'ESP', name: 'Spain', capital: 'Madrid', at: { lat: 40.4168, lon: -3.7038 }, land: EA },
  { iso: 'SWE', name: 'Sweden', capital: 'Stockholm', at: { lat: 59.3293, lon: 18.0686 }, land: EA },
  { iso: 'CHE', name: 'Switzerland', capital: 'Bern', at: { lat: 46.948, lon: 7.4474 }, land: EA },
  { iso: 'UKR', name: 'Ukraine', capital: 'Kyiv', at: { lat: 50.4501, lon: 30.5234 }, land: EA },
  { iso: 'GBR', name: 'United Kingdom', capital: 'London', at: { lat: 51.5074, lon: -0.1278 }, land: 'GBR' },
  // Africa
  { iso: 'DZA', name: 'Algeria', capital: 'Algiers', at: { lat: 36.7538, lon: 3.0588 }, land: EA },
  { iso: 'EGY', name: 'Egypt', capital: 'Cairo', at: { lat: 30.0444, lon: 31.2357 }, land: EA },
  { iso: 'ETH', name: 'Ethiopia', capital: 'Addis Ababa', at: { lat: 9.03, lon: 38.7469 }, land: EA },
  { iso: 'GHA', name: 'Ghana', capital: 'Accra', at: { lat: 5.6037, lon: -0.187 }, land: EA },
  { iso: 'KEN', name: 'Kenya', capital: 'Nairobi', at: { lat: -1.2921, lon: 36.8219 }, land: EA },
  { iso: 'MAR', name: 'Morocco', capital: 'Rabat', at: { lat: 34.0209, lon: -6.8416 }, land: EA },
  { iso: 'NGA', name: 'Nigeria', capital: 'Abuja', at: { lat: 9.0765, lon: 7.3986 }, land: EA },
  { iso: 'SEN', name: 'Senegal', capital: 'Dakar', at: { lat: 14.7167, lon: -17.4677 }, land: EA },
  { iso: 'ZAF', name: 'South Africa', capital: 'Pretoria', at: { lat: -25.7479, lon: 28.2293 }, land: EA },
  { iso: 'TZA', name: 'Tanzania', capital: 'Dodoma', at: { lat: -6.163, lon: 35.7516 }, land: EA },
  { iso: 'TUN', name: 'Tunisia', capital: 'Tunis', at: { lat: 36.8065, lon: 10.1815 }, land: EA },
  // Americas
  { iso: 'CAN', name: 'Canada', capital: 'Ottawa', at: { lat: 45.4215, lon: -75.6972 }, land: NA },
  { iso: 'CUB', name: 'Cuba', capital: 'Havana', at: { lat: 23.1136, lon: -82.3666 }, land: 'CUB' },
  { iso: 'MEX', name: 'Mexico', capital: 'Mexico City', at: { lat: 19.4326, lon: -99.1332 }, land: NA },
  { iso: 'USA', name: 'United States', capital: 'Washington, D.C.', at: { lat: 38.9072, lon: -77.0369 }, land: NA },
  { iso: 'ARG', name: 'Argentina', capital: 'Buenos Aires', at: { lat: -34.6037, lon: -58.3816 }, land: SA },
  { iso: 'BRA', name: 'Brazil', capital: 'Brasília', at: { lat: -15.7939, lon: -47.8828 }, land: SA },
  { iso: 'CHL', name: 'Chile', capital: 'Santiago', at: { lat: -33.4489, lon: -70.6693 }, land: SA },
  { iso: 'COL', name: 'Colombia', capital: 'Bogotá', at: { lat: 4.711, lon: -74.0721 }, land: SA },
  { iso: 'PER', name: 'Peru', capital: 'Lima', at: { lat: -12.0464, lon: -77.0428 }, land: SA },
  // Oceania
  { iso: 'AUS', name: 'Australia', capital: 'Canberra', at: { lat: -35.2809, lon: 149.13 }, land: 'AUS' },
  { iso: 'NZL', name: 'New Zealand', capital: 'Wellington', at: { lat: -41.2866, lon: 174.7756 }, land: 'NZL' },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryByIso(iso: string | null | undefined): JourneyCountry | undefined {
  return iso ? JOURNEY_COUNTRIES.find((c) => c.iso === iso) : undefined;
}
