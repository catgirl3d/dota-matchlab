import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

afterEach(cleanup);

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/matches/:matchId" element={<div>Public match route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage match search', () => {
  it('opens a valid numeric match route', async () => {
    renderLanding();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '8749050591' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Analysis' }));

    expect(await screen.findByText('Public match route')).toBeVisible();
  });

  it('keeps invalid input on the landing and explains the error', () => {
    renderLanding();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'not-a-match' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Analysis' }));

    expect(screen.getByText('Please enter a valid numeric match ID.')).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});

