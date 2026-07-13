import { describe, expect, it } from 'vitest';
import { getPricingUnitLabel } from './pricing';

describe('getPricingUnitLabel', () => {
  it('maps known units and defaults to tokens', () => {
    expect(getPricingUnitLabel('seconds')).toBe('/ sec');
    expect(getPricingUnitLabel('requests')).toBe('/ req');
    expect(getPricingUnitLabel(undefined)).toBe('/ M tokens');
    expect(getPricingUnitLabel('tokens' as never)).toBe('/ M tokens');
  });
});
