import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the app title', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText(/Expected PO Receipts/i)).toBeInTheDocument();
  });
});
