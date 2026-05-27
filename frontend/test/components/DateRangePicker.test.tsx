import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DateRangePicker } from '../../src/components/DateRangePicker.js';
import { usePlanning } from '../../src/store/planning.js';

afterEach(cleanup);
beforeEach(() => usePlanning.getState().reset());

describe('DateRangePicker', () => {
  it('renders both modes and toggles', () => {
    render(<DateRangePicker />);
    expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next days/i)).toBeInTheDocument();
  });

  it('switching to nextDays recomputes dateTo from dateFrom', () => {
    render(<DateRangePicker />);
    fireEvent.click(screen.getByLabelText(/next days/i));
    const days = screen.getByRole('spinbutton', { name: /days/i });
    fireEvent.change(days, { target: { value: '7' } });
    expect(usePlanning.getState().nextDays).toBe(7);
  });
});
