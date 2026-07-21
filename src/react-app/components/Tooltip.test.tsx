import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows portal content on hover and associates it with the trigger', () => {
    render(<Tooltip content="Light support"><img alt="Position 5" src="/position-5.webp" /></Tooltip>);

    const trigger = screen.getByRole('img', { name: 'Position 5' }).parentElement as HTMLElement;
    fireEvent.pointerEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Light support');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.pointerLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on focus and closes with Escape', () => {
    render(<Tooltip content="Mid"><img alt="Position 2" src="/position-2.webp" /></Tooltip>);

    const trigger = screen.getByRole('img', { name: 'Position 2' }).parentElement as HTMLElement;
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mid');

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('can keep static labels out of keyboard navigation', () => {
    render(<Tooltip content="Net worth" focusable={false}><span>NET</span></Tooltip>);

    const trigger = screen.getByText('NET').parentElement as HTMLElement;
    expect(trigger).not.toHaveAttribute('tabindex');

    fireEvent.pointerEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Net worth');
  });
});
