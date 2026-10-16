/**
 * Tour stops for the Living Earth. Coordinates are real; descriptions are
 * limited to well-established facts and carry no invented figures.
 */

import type { LatLon } from './geo';

export interface Region {
  id: string;
  name: string;
  /** Where the camera looks. */
  at: LatLon;
  /** Camera distance in globe radii — lower is closer. */
  distance: number;
  kicker: string;
  body: string;
}

export const OVERVIEW: Region = {
  id: 'overview',
  name: 'Earth',
  at: { lat: 18, lon: 20 },
  distance: 4.3,
  kicker: 'The whole system',
  body: 'One atmosphere, shared by everyone. Every footprint lands here.',
};

export const REGIONS: Region[] = [
  {
    id: 'amazon',
    name: 'Amazon Basin',
    at: { lat: -3.4653, lon: -62.2159 },
    distance: 3.6,
    kicker: 'South America',
    body: 'The largest tropical rainforest on Earth — a vast store of carbon in living trees and soil.',
  },
  {
    id: 'congo',
    name: 'Congo Basin',
    at: { lat: -0.6, lon: 23.4 },
    distance: 3.6,
    kicker: 'Central Africa',
    body: 'The second-largest tropical rainforest, spanning six countries.',
  },
  {
    id: 'himalaya',
    name: 'Himalaya',
    at: { lat: 27.9881, lon: 86.925 },
    distance: 3.6,
    kicker: 'South Asia',
    body: 'Glaciers here feed the Indus, Ganges and Brahmaputra, rivers that hundreds of millions of people depend on.',
  },
  {
    id: 'greenland',
    name: 'Greenland Ice Sheet',
    at: { lat: 72, lon: -40 },
    distance: 3.6,
    kicker: 'Arctic',
    body: 'The second-largest body of ice on the planet, after Antarctica.',
  },
  {
    id: 'reef',
    name: 'Great Barrier Reef',
    at: { lat: -18.2871, lon: 147.6992 },
    distance: 3.6,
    kicker: 'Coral Sea',
    body: 'The world’s largest coral reef system, sensitive to warming oceans.',
  },
];

export const ALL_STOPS: Region[] = [OVERVIEW, ...REGIONS];
