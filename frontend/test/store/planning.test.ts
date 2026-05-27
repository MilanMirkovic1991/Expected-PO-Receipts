import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanning } from '../../src/store/planning.js';

beforeEach(() => usePlanning.getState().reset());

describe('planning store', () => {
  it('toggles selection of release ids', () => {
    usePlanning.getState().toggle(100);
    expect(usePlanning.getState().isSelected(100)).toBe(true);
    usePlanning.getState().toggle(100);
    expect(usePlanning.getState().isSelected(100)).toBe(false);
  });

  it('selectAll adds ids, deselectAll removes them', () => {
    usePlanning.getState().selectAll([1, 2, 3]);
    expect([...usePlanning.getState().selected]).toHaveLength(3);
    usePlanning.getState().deselectAll([2]);
    expect(usePlanning.getState().isSelected(2)).toBe(false);
  });

  it('stores assigned employee id', () => {
    usePlanning.getState().setAssignedEmployeeId(42);
    expect(usePlanning.getState().assignedEmployeeId).toBe(42);
  });
});
