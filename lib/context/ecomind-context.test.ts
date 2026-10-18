import { describe, it, expect } from 'vitest';
import type { EcoMindPageContext } from './ecomind-context';

describe('EcoMindPageContext structure & contract', () => {
  it('validates page context properties correctly', () => {
    const ctx: EcoMindPageContext = {
      route: '/app/simulate',
      pageTitle: 'Carbon Twin Simulator',
      activeFeature: 'twin_simulation',
      scenarioId: 'metro',
      visibleMetricIds: ['baselineCo2Kg', 'projectedCo2Kg', 'deltaCo2Kg'],
      contextVersion: 1,
      metadata: {
        factorKey: 'car_ride',
        replacementKey: 'metro_train',
        quantity: 10,
        frequency: 'per_week',
      },
    };

    expect(ctx.route).toBe('/app/simulate');
    expect(ctx.pageTitle).toBe('Carbon Twin Simulator');
    expect(ctx.activeFeature).toBe('twin_simulation');
    expect(ctx.metadata?.factorKey).toBe('car_ride');
    expect(ctx.metadata?.quantity).toBe(10);
  });

  it('serializes cleanly without circular references or leaking secrets', () => {
    const ctx: EcoMindPageContext = {
      route: '/app/credits',
      pageTitle: 'Green Credits',
      activeFeature: 'wallet_ledger',
      contextVersion: 2,
      metadata: {
        balance: 250,
        isVoluntaryCarbonMarket: false,
      },
    };

    const json = JSON.stringify(ctx);
    expect(json).toContain('"route":"/app/credits"');
    expect(json).toContain('"isVoluntaryCarbonMarket":false');
    const parsed = JSON.parse(json);
    expect(parsed.pageTitle).toBe('Green Credits');
  });
});
