import { api } from './client';

export interface DashboardData {
  todayTotal: number;
  yesterdayTotal: number;
  deltaPct: number;
  todayBreakdown: Record<string, number>;
  weekBreakdown: Record<string, number>;
  weekTotals: { date: string; total: number }[];
  biggestCategory: string | null;
  biggestValue: number;
  streak: number;
  totalSaved: number;
  todayLogs: { id: string; category: string; label: string; emoji: string; co2Kg: number; note: string }[];
  /** Distinct days with a logged activity, all time. */
  daysTracked?: number;
  /** Plan actions completed (from the credit ledger). */
  actionsCompleted?: number;
}

export async function getDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>('/api/dashboard');
}

export interface EmissionFactorData {
  id: string;
  category: string;
  factorKey: string;
  label: string;
  emoji: string;
  unit: string;
  factorKgPerUnit: number;
  defaultQty: number;
}

export const DEFAULT_EMISSION_FACTORS: EmissionFactorData[] = [
  // travel
  { id: 'ef-car', category: 'travel', factorKey: 'car_ride', label: 'Car ride', emoji: '🚗', unit: 'km', factorKgPerUnit: 0.18, defaultQty: 10 },
  { id: 'ef-motor', category: 'travel', factorKey: 'motorbike', label: 'Motorbike', emoji: '🛵', unit: 'km', factorKgPerUnit: 0.10, defaultQty: 10 },
  { id: 'ef-bus', category: 'travel', factorKey: 'bus', label: 'Bus', emoji: '🚌', unit: 'km', factorKgPerUnit: 0.08, defaultQty: 10 },
  { id: 'ef-train', category: 'travel', factorKey: 'metro_train', label: 'Metro / Train', emoji: '🚇', unit: 'km', factorKgPerUnit: 0.04, defaultQty: 10 },
  { id: 'ef-flight', category: 'travel', factorKey: 'flight', label: 'Flight', emoji: '✈️', unit: 'km', factorKgPerUnit: 0.25, defaultQty: 500 },
  { id: 'ef-bike', category: 'travel', factorKey: 'bike', label: 'Bike', emoji: '🚲', unit: 'km', factorKgPerUnit: 0.00, defaultQty: 5 },
  { id: 'ef-walk', category: 'travel', factorKey: 'walk', label: 'Walk', emoji: '🚶', unit: 'km', factorKgPerUnit: 0.00, defaultQty: 3 },
  // food
  { id: 'ef-beef', category: 'food', factorKey: 'beef_meal', label: 'Beef meal', emoji: '🥩', unit: 'item', factorKgPerUnit: 5.0, defaultQty: 1 },
  { id: 'ef-chicken', category: 'food', factorKey: 'chicken_meal', label: 'Chicken meal', emoji: '🍗', unit: 'item', factorKgPerUnit: 1.2, defaultQty: 1 },
  { id: 'ef-fish', category: 'food', factorKey: 'fish_meal', label: 'Fish meal', emoji: '🐟', unit: 'item', factorKgPerUnit: 1.3, defaultQty: 1 },
  { id: 'ef-veg', category: 'food', factorKey: 'veg_meal', label: 'Veg meal', emoji: '🥗', unit: 'item', factorKgPerUnit: 0.6, defaultQty: 1 },
  { id: 'ef-vegan', category: 'food', factorKey: 'vegan_meal', label: 'Vegan meal', emoji: '🌱', unit: 'item', factorKgPerUnit: 0.4, defaultQty: 1 },
  { id: 'ef-dairy', category: 'food', factorKey: 'dairy', label: 'Dairy', emoji: '🧀', unit: 'item', factorKgPerUnit: 1.0, defaultQty: 1 },
  { id: 'ef-delivery', category: 'food', factorKey: 'food_delivery', label: 'Food delivery', emoji: '🛵', unit: 'item', factorKgPerUnit: 0.6, defaultQty: 1 },
  // electricity
  { id: 'ef-elec', category: 'electricity', factorKey: 'home_electricity', label: 'Home electricity', emoji: '⚡', unit: 'kWh', factorKgPerUnit: 0.45, defaultQty: 4 },
  { id: 'ef-ac', category: 'electricity', factorKey: 'air_conditioning', label: 'Air conditioning', emoji: '❄️', unit: 'kWh', factorKgPerUnit: 0.45, defaultQty: 6 },
  { id: 'ef-heater', category: 'electricity', factorKey: 'geyser_heater', label: 'Geyser / heater', emoji: '🔥', unit: 'kWh', factorKgPerUnit: 0.45, defaultQty: 3 },
  { id: 'ef-laundry', category: 'electricity', factorKey: 'laundry_dryer', label: 'Laundry + dryer', emoji: '🧺', unit: 'kWh', factorKgPerUnit: 0.45, defaultQty: 2 },
  // shopping
  { id: 'ef-cloth', category: 'shopping', factorKey: 'clothing_item', label: 'Clothing item', emoji: '👕', unit: 'item', factorKgPerUnit: 10.0, defaultQty: 1 },
  { id: 'ef-elec-item', category: 'shopping', factorKey: 'electronics', label: 'Electronics', emoji: '📱', unit: 'item', factorKgPerUnit: 30.0, defaultQty: 1 },
  { id: 'ef-order', category: 'shopping', factorKey: 'online_order', label: 'Online order', emoji: '📦', unit: 'item', factorKgPerUnit: 2.5, defaultQty: 1 },
  { id: 'ef-grocery', category: 'shopping', factorKey: 'groceries', label: 'Groceries', emoji: '🛒', unit: 'item', factorKgPerUnit: 1.0, defaultQty: 1 },
  // waste
  { id: 'ef-waste', category: 'waste', factorKey: 'general_waste', label: 'General waste', emoji: '🗑️', unit: 'item', factorKgPerUnit: 0.5, defaultQty: 1 },
  { id: 'ef-bottle', category: 'waste', factorKey: 'plastic_bottle', label: 'Plastic bottle', emoji: '🥤', unit: 'item', factorKgPerUnit: 0.2, defaultQty: 1 },
  { id: 'ef-foodwaste', category: 'waste', factorKey: 'food_waste', label: 'Food waste', emoji: '🍂', unit: 'item', factorKgPerUnit: 0.4, defaultQty: 1 },
];

export async function getEmissionFactors(region = 'GLOBAL'): Promise<EmissionFactorData[]> {
  try {
    const res = await api.get<EmissionFactorData[]>(`/api/emission-factors?region=${region}`);
    if (Array.isArray(res) && res.length > 0) return res;
    return DEFAULT_EMISSION_FACTORS;
  } catch {
    return DEFAULT_EMISSION_FACTORS;
  }
}
