import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformSelector } from '@/components/PlatformSelector';
import { useAppStore, DEFAULT_LIMITS, LimitsConfig } from '@/store/useAppStore';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

const setProfileResponse = (profile: { plan?: string | null; limits?: Partial<LimitsConfig> | null } | null) => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: profile, error: null }),
          }),
        }),
      };
    }

    if (table === 'usage_events') {
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({ count: 0, error: null }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    };
  });
};

const renderSelectorWithState = (maxPlatforms: number | null) => {
  const Wrapper = () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    return <PlatformSelector selected={selected} onChange={setSelected} maxPlatforms={maxPlatforms} />;
  };

  render(<Wrapper />);
};

describe('Plan gating', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    useAppStore.setState((state) => ({
      ...state,
      user: null,
      plan: 'free',
      limits: DEFAULT_LIMITS,
      dailyUsed: 0,
      loading: false,
      brandVoiceSelection: null,
    }));
  });

  it('allows pro users to select all six platforms and use brand voice', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'pro-user' } } });
    setProfileResponse({
      plan: 'pro',
      limits: {
        daily_generations: null,
        max_platforms_per_request: 6,
        brand_voice: true,
        blog_to_sns: true,
        max_blog_length: null,
        variations_per_request: null,
        history_limit: null,
        priority_routing: true,
      },
    });

    await useAppStore.getState().loadProfileAndLimits();

    expect(useAppStore.getState().plan).toBe('pro');
    expect(useAppStore.getState().maxPlatforms).toBe(6);
    expect(useAppStore.getState().brandVoiceAllowed).toBe(true);

    renderSelectorWithState(useAppStore.getState().maxPlatforms);

    ['Facebook', 'Instagram', 'LinkedIn', 'Twitter', 'Threads', 'YouTube'].forEach((label) => {
      fireEvent.click(screen.getByText(label));
    });

    expect(screen.getByText('6/6 selected')).toBeTruthy();
    expect(screen.getByText('YouTube').closest('button')?.disabled).toBeFalsy();
  });

  it('blocks free users from exceeding one platform and disables brand voice', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'free-user' } } });
    setProfileResponse({
      plan: 'free',
      limits: {
        ...DEFAULT_LIMITS,
        max_platforms_per_request: 1,
        brand_voice: false,
      },
    });

    await useAppStore.getState().loadProfileAndLimits();

    expect(useAppStore.getState().plan).toBe('free');
    expect(useAppStore.getState().maxPlatforms).toBe(1);
    expect(useAppStore.getState().brandVoiceAllowed).toBe(false);

    renderSelectorWithState(useAppStore.getState().maxPlatforms);

    fireEvent.click(screen.getByText('Facebook'));
    fireEvent.click(screen.getByText('Instagram'));

    expect(screen.getByText('1/6 selected')).toBeTruthy();
    expect((screen.getByText('Instagram').closest('button') as HTMLButtonElement)?.disabled).toBe(true);
  });
});
