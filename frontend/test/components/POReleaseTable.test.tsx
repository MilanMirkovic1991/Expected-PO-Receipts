import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { POReleaseTable } from '../../src/components/POReleaseTable.js';
import { usePlanning } from '../../src/store/planning.js';

afterEach(cleanup);
beforeEach(() => usePlanning.getState().reset());

const groups = [{
  date: '2026-05-28', items: [
    { poReleaseId: 100, poDetailId: 10, poId: 1, poNo: 'PO-1', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D1', qtyExpected: 100, promiseDate: '2026-05-28', defaultRecvDesignator: 'DEFAULT' },
    { poReleaseId: 101, poDetailId: 11, poId: 1, poNo: 'PO-1', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'D2', qtyExpected: 50, promiseDate: '2026-05-28', defaultRecvDesignator: 'ZONE-A' },
  ],
}];

describe('POReleaseTable', () => {
  it('renders one section per date group with all items', () => {
    render(<POReleaseTable groups={groups} />);
    expect(screen.getByText('2026-05-28')).toBeInTheDocument();
    expect(screen.getByText('ITM-1')).toBeInTheDocument();
    expect(screen.getByText('ITM-2')).toBeInTheDocument();
  });

  it('toggling row checkbox updates selection store', () => {
    render(<POReleaseTable groups={groups} />);
    const rowChecks = screen.getAllByRole('checkbox', { name: /select item/i });
    fireEvent.click(rowChecks[0]!);
    expect(usePlanning.getState().isSelected(100)).toBe(true);
  });

  it('master checkbox selects all in a date group', () => {
    render(<POReleaseTable groups={groups} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select all for 2026-05-28/i }));
    expect(usePlanning.getState().isSelected(100)).toBe(true);
    expect(usePlanning.getState().isSelected(101)).toBe(true);
  });
});
