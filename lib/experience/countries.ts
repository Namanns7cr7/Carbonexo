/**
 * Major countries for the journey planner: each one's capital (where a trip starts
 * or ends, the same placement convention as co2.ts). Coordinates are the capital
 * cities' real positions.
 */

import type { LatLon } from './geo';

export interface JourneyCountry {
  iso: string;
  name: string;
  capital: string;
  at: LatLon;
}

export const JOURNEY_COUNTRIES: JourneyCountry[] = [
  // Asia
  { iso: 'AFG', name: 'Afghanistan', capital: 'Kabul', at: { lat: 34.5553, lon: 69.2075 } },
  { iso: 'BGD', name: 'Bangladesh', capital: 'Dhaka', at: { lat: 23.8103, lon: 90.4125 } },
  { iso: 'KHM', name: 'Cambodia', capital: 'Phnom Penh', at: { lat: 11.5564, lon: 104.9282 } },
  { iso: 'CHN', name: 'China', capital: 'Beijing', at: { lat: 39.9042, lon: 116.4074 } },
  { iso: 'IND', name: 'India', capital: 'New Delhi', at: { lat: 28.6139, lon: 77.209 } },
  { iso: 'IDN', name: 'Indonesia', capital: 'Jakarta', at: { lat: -6.2088, lon: 106.8456 } },
  { iso: 'IRN', name: 'Iran', capital: 'Tehran', at: { lat: 35.6892, lon: 51.389 } },
  { iso: 'IRQ', name: 'Iraq', capital: 'Baghdad', at: { lat: 33.3152, lon: 44.3661 } },
  { iso: 'ISR', name: 'Israel', capital: 'Jerusalem', at: { lat: 31.7683, lon: 35.2137 } },
  { iso: 'JPN', name: 'Japan', capital: 'Tokyo', at: { lat: 35.6762, lon: 139.6503 } },
  { iso: 'JOR', name: 'Jordan', capital: 'Amman', at: { lat: 31.9454, lon: 35.9284 } },
  { iso: 'KAZ', name: 'Kazakhstan', capital: 'Astana', at: { lat: 51.1694, lon: 71.4491 } },
  { iso: 'LAO', name: 'Laos', capital: 'Vientiane', at: { lat: 17.9757, lon: 102.6331 } },
  { iso: 'MYS', name: 'Malaysia', capital: 'Kuala Lumpur', at: { lat: 3.139, lon: 101.6869 } },
  { iso: 'MNG', name: 'Mongolia', capital: 'Ulaanbaatar', at: { lat: 47.8864, lon: 106.9057 } },
  { iso: 'MMR', name: 'Myanmar', capital: 'Naypyidaw', at: { lat: 19.7633, lon: 96.0785 } },
  { iso: 'NPL', name: 'Nepal', capital: 'Kathmandu', at: { lat: 27.7172, lon: 85.324 } },
  { iso: 'PAK', name: 'Pakistan', capital: 'Islamabad', at: { lat: 33.6844, lon: 73.0479 } },
  { iso: 'PHL', name: 'Philippines', capital: 'Manila', at: { lat: 14.5995, lon: 120.9842 } },
  { iso: 'QAT', name: 'Qatar', capital: 'Doha', at: { lat: 25.2854, lon: 51.531 } },
  { iso: 'SAU', name: 'Saudi Arabia', capital: 'Riyadh', at: { lat: 24.7136, lon: 46.6753 } },
  { iso: 'SGP', name: 'Singapore', capital: 'Singapore', at: { lat: 1.3521, lon: 103.8198 } },
  { iso: 'KOR', name: 'South Korea', capital: 'Seoul', at: { lat: 37.5665, lon: 126.978 } },
  { iso: 'LKA', name: 'Sri Lanka', capital: 'Colombo', at: { lat: 6.9271, lon: 79.8612 } },
  { iso: 'TWN', name: 'Taiwan', capital: 'Taipei', at: { lat: 25.033, lon: 121.5654 } },
  { iso: 'THA', name: 'Thailand', capital: 'Bangkok', at: { lat: 13.7563, lon: 100.5018 } },
  { iso: 'TUR', name: 'Türkiye', capital: 'Ankara', at: { lat: 39.9334, lon: 32.8597 } },
  { iso: 'ARE', name: 'United Arab Emirates', capital: 'Abu Dhabi', at: { lat: 24.4539, lon: 54.3773 } },
  { iso: 'UZB', name: 'Uzbekistan', capital: 'Tashkent', at: { lat: 41.2995, lon: 69.2401 } },
  { iso: 'VNM', name: 'Vietnam', capital: 'Hanoi', at: { lat: 21.0285, lon: 105.8542 } },
  // Europe
  { iso: 'AUT', name: 'Austria', capital: 'Vienna', at: { lat: 48.2082, lon: 16.3738 } },
  { iso: 'BEL', name: 'Belgium', capital: 'Brussels', at: { lat: 50.8503, lon: 4.3517 } },
  { iso: 'CZE', name: 'Czechia', capital: 'Prague', at: { lat: 50.0755, lon: 14.4378 } },
  { iso: 'DNK', name: 'Denmark', capital: 'Copenhagen', at: { lat: 55.6761, lon: 12.5683 } },
  { iso: 'FIN', name: 'Finland', capital: 'Helsinki', at: { lat: 60.1699, lon: 24.9384 } },
  { iso: 'FRA', name: 'France', capital: 'Paris', at: { lat: 48.8566, lon: 2.3522 } },
  { iso: 'DEU', name: 'Germany', capital: 'Berlin', at: { lat: 52.52, lon: 13.405 } },
  { iso: 'GRC', name: 'Greece', capital: 'Athens', at: { lat: 37.9838, lon: 23.7275 } },
  { iso: 'HUN', name: 'Hungary', capital: 'Budapest', at: { lat: 47.4979, lon: 19.0402 } },
  { iso: 'ISL', name: 'Iceland', capital: 'Reykjavik', at: { lat: 64.1466, lon: -21.9426 } },
  { iso: 'IRL', name: 'Ireland', capital: 'Dublin', at: { lat: 53.3498, lon: -6.2603 } },
  { iso: 'ITA', name: 'Italy', capital: 'Rome', at: { lat: 41.9028, lon: 12.4964 } },
  { iso: 'NLD', name: 'Netherlands', capital: 'Amsterdam', at: { lat: 52.3676, lon: 4.9041 } },
  { iso: 'NOR', name: 'Norway', capital: 'Oslo', at: { lat: 59.9139, lon: 10.7522 } },
  { iso: 'POL', name: 'Poland', capital: 'Warsaw', at: { lat: 52.2297, lon: 21.0122 } },
  { iso: 'PRT', name: 'Portugal', capital: 'Lisbon', at: { lat: 38.7223, lon: -9.1393 } },
  { iso: 'ROU', name: 'Romania', capital: 'Bucharest', at: { lat: 44.4268, lon: 26.1025 } },
  { iso: 'RUS', name: 'Russia', capital: 'Moscow', at: { lat: 55.7558, lon: 37.6173 } },
  { iso: 'ESP', name: 'Spain', capital: 'Madrid', at: { lat: 40.4168, lon: -3.7038 } },
  { iso: 'SWE', name: 'Sweden', capital: 'Stockholm', at: { lat: 59.3293, lon: 18.0686 } },
  { iso: 'CHE', name: 'Switzerland', capital: 'Bern', at: { lat: 46.948, lon: 7.4474 } },
  { iso: 'UKR', name: 'Ukraine', capital: 'Kyiv', at: { lat: 50.4501, lon: 30.5234 } },
  { iso: 'GBR', name: 'United Kingdom', capital: 'London', at: { lat: 51.5074, lon: -0.1278 } },
  // Africa
  { iso: 'DZA', name: 'Algeria', capital: 'Algiers', at: { lat: 36.7538, lon: 3.0588 } },
  { iso: 'EGY', name: 'Egypt', capital: 'Cairo', at: { lat: 30.0444, lon: 31.2357 } },
  { iso: 'ETH', name: 'Ethiopia', capital: 'Addis Ababa', at: { lat: 9.03, lon: 38.7469 } },
  { iso: 'GHA', name: 'Ghana', capital: 'Accra', at: { lat: 5.6037, lon: -0.187 } },
  { iso: 'KEN', name: 'Kenya', capital: 'Nairobi', at: { lat: -1.2921, lon: 36.8219 } },
  { iso: 'MAR', name: 'Morocco', capital: 'Rabat', at: { lat: 34.0209, lon: -6.8416 } },
  { iso: 'NGA', name: 'Nigeria', capital: 'Abuja', at: { lat: 9.0765, lon: 7.3986 } },
  { iso: 'SEN', name: 'Senegal', capital: 'Dakar', at: { lat: 14.7167, lon: -17.4677 } },
  { iso: 'ZAF', name: 'South Africa', capital: 'Pretoria', at: { lat: -25.7479, lon: 28.2293 } },
  { iso: 'TZA', name: 'Tanzania', capital: 'Dodoma', at: { lat: -6.163, lon: 35.7516 } },
  { iso: 'TUN', name: 'Tunisia', capital: 'Tunis', at: { lat: 36.8065, lon: 10.1815 } },
  // Americas
  { iso: 'CAN', name: 'Canada', capital: 'Ottawa', at: { lat: 45.4215, lon: -75.6972 } },
  { iso: 'CUB', name: 'Cuba', capital: 'Havana', at: { lat: 23.1136, lon: -82.3666 } },
  { iso: 'MEX', name: 'Mexico', capital: 'Mexico City', at: { lat: 19.4326, lon: -99.1332 } },
  { iso: 'USA', name: 'United States', capital: 'Washington, D.C.', at: { lat: 38.9072, lon: -77.0369 } },
  { iso: 'ARG', name: 'Argentina', capital: 'Buenos Aires', at: { lat: -34.6037, lon: -58.3816 } },
  { iso: 'BRA', name: 'Brazil', capital: 'Brasília', at: { lat: -15.7939, lon: -47.8828 } },
  { iso: 'CHL', name: 'Chile', capital: 'Santiago', at: { lat: -33.4489, lon: -70.6693 } },
  { iso: 'COL', name: 'Colombia', capital: 'Bogotá', at: { lat: 4.711, lon: -74.0721 } },
  { iso: 'PER', name: 'Peru', capital: 'Lima', at: { lat: -12.0464, lon: -77.0428 } },
  // Oceania
  { iso: 'AUS', name: 'Australia', capital: 'Canberra', at: { lat: -35.2809, lon: 149.13 } },
  { iso: 'NZL', name: 'New Zealand', capital: 'Wellington', at: { lat: -41.2866, lon: 174.7756 } },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryByIso(iso: string | null | undefined): JourneyCountry | undefined {
  return iso ? JOURNEY_COUNTRIES.find((c) => c.iso === iso) : undefined;
}
