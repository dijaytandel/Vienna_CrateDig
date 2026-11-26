import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '../app/router';
import * as push from '../lib/push';
import { FakeAuth } from '../test/auth';

vi.mock('../lib/push', () => ({
  pushSupported: vi.fn(() => true),
  needsHomeScreenInstall: vi.fn(() => false),
  currentPushSubscription: vi.fn(async () => null),
  enableBroadcastPush: vi.fn(async () => {}),
  disableBroadcastPush: vi.fn(async () => {}),
}));

function renderProfile() {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: ['/profile'] });
  render(
    <FakeAuth user={{ displayName: 'Dana', role: 'collector' }}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('broadcast push toggle', () => {
  it('never asks for permission until the toggle is switched on', async () => {
    renderProfile();
    const toggle = await screen.findByRole('switch', { name: /Store broadcast notifications/ });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(push.enableBroadcastPush).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(push.enableBroadcastPush).toHaveBeenCalledTimes(1);
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(push.disableBroadcastPush).toHaveBeenCalledTimes(1);
  });

  it('explains a blocked permission', async () => {
    vi.mocked(push.enableBroadcastPush).mockRejectedValueOnce(
      new Error('Notifications are blocked.'),
    );
    renderProfile();
    const toggle = await screen.findByRole('switch', { name: /Store broadcast notifications/ });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications are blocked.');
    expect(toggle).not.toBeChecked();
  });

  it('tells iPhone users to install the app first', async () => {
    vi.mocked(push.pushSupported).mockReturnValue(false);
    vi.mocked(push.needsHomeScreenInstall).mockReturnValue(true);
    renderProfile();
    expect(await screen.findByText(/add CrateDig to your Home Screen/)).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
