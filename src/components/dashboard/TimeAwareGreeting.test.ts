/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeAwareGreeting } from './TimeAwareGreeting';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const h = React.createElement;
describe('Approved time-aware dashboard greeting', () => {
  it.each([
    [0, 0, 'Buenas noches'], [5, 59, 'Buenas noches'],
    [6, 0, 'Buenos días'], [11, 59, 'Buenos días'],
    [12, 0, 'Buenas tardes'], [19, 59, 'Buenas tardes'],
    [20, 0, 'Buenas noches'], [23, 59, 'Buenas noches'],
  ])('uses the local clock at %s:%s', (hour, minute, greeting) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, hour as number, minute as number));
    render(h(TimeAwareGreeting, { name: 'Admin' }));
    expect(screen.getByText(`${greeting}, Admin.`)).toBeTruthy();
  });
  it('keeps the neutral server-rendered fallback', () => {
    expect(renderToString(h(TimeAwareGreeting, { name: 'Admin' }))).toBe('Hola<!-- -->, <!-- -->Admin<!-- -->.');
  });
  it.each([[5, 'Buenos días'], [11, 'Buenas tardes'], [19, 'Buenas noches'], [23, 'Buenas noches']])(
    'refreshes across the %s:59 boundary without remounting', (hour, greeting) => {
      vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, hour as number, 59));
      render(h(TimeAwareGreeting, { name: 'Admin' }));
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByText(`${greeting}, Admin.`)).toBeTruthy();
    },
  );
});
