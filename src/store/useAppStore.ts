import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type Plan = 'free' | 'pro';

export interface LimitsConfig {
  daily_generations: number | null;
  max_platforms_per_request: number | null;
  brand_voice: boolean;
  blog_to_sns: boolean;
  max_blog_length: number | null;
  variations_per_request: number | null;
  history_limit: number | null;
  priority_routing: boolean;
}

export interface BrandVoiceSelection {
  id: string;
  label?: string;
  voice: {
    tone: string;
    sentenceStyle: string;
    vocabulary: string[];
    strictness: number;
    formatTraits?: string[];
  };
}

interface AppState {
  user: any | null;
  plan: Plan;
  limits: LimitsConfig;
  dailyUsed: number;
  loading: boolean;
  brandVoiceSelection: BrandVoiceSelection | null;
  
  // Computed getters
  brandVoiceAllowed: boolean;
  maxPlatforms: number | null;
  maxBlogLength: number | null;
  variationsAllowed: number | null;
  
  // Actions
  setUser: (user: any) => void;
  setBrandVoice: (selection: BrandVoiceSelection | null) => void;
  loadProfileAndLimits: () => Promise<void>;
  loadDailyUsage: () => Promise<void>;
  refreshAfterBilling: () => Promise<void>;
  reset: () => void;
}

export const DEFAULT_LIMITS: LimitsConfig = {
  daily_generations: 5,
  max_platforms_per_request: 1,
  brand_voice: false,
  blog_to_sns: true,
  max_blog_length: 2000,
  variations_per_request: 1,
  history_limit: 50,
  priority_routing: false,
};

export const PRO_LIMITS: LimitsConfig = {
  daily_generations: null,
  max_platforms_per_request: 6,
  brand_voice: true,
  blog_to_sns: true,
  max_blog_length: null,
  variations_per_request: null,
  history_limit: null,
  priority_routing: true,
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  plan: 'free',
  limits: DEFAULT_LIMITS,
  dailyUsed: 0,
  loading: true,
  brandVoiceSelection:
    typeof window !== 'undefined'
      ? (() => {
          try {
            const stored = localStorage.getItem('defaultBrandVoiceSelection');
            return stored ? (JSON.parse(stored) as BrandVoiceSelection) : null;
          } catch (err) {
            console.error('Failed to read stored brand voice selection', err);
            return null;
          }
        })()
      : null,
  
  // Computed getters
  get brandVoiceAllowed() {
    return get().limits.brand_voice;
  },
  get maxPlatforms() {
    return get().limits.max_platforms_per_request;
  },
  get maxBlogLength() {
    return get().limits.max_blog_length;
  },
  get variationsAllowed() {
    return get().limits.variations_per_request;
  },
  
  setUser: (user) => set({ user }),

  setBrandVoice: (selection) => {
    try {
      if (typeof window !== 'undefined') {
        if (selection) {
          localStorage.setItem('defaultBrandVoiceSelection', JSON.stringify(selection));
        } else {
          localStorage.removeItem('defaultBrandVoiceSelection');
        }
      }
    } catch (err) {
      console.error('Failed to persist brand voice selection', err);
    }

    set({ brandVoiceSelection: selection });
  },
  
  loadProfileAndLimits: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('plan, limits')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading profile:', error);
        set({ loading: false });
        return;
      }
      
      const plan = (profile?.plan as Plan) || 'free';
      const limitOverrides = (profile?.limits as Partial<LimitsConfig> | null | undefined) ?? undefined;
      const baseLimits = plan === 'pro' ? PRO_LIMITS : DEFAULT_LIMITS;
      const limits = { ...baseLimits, ...limitOverrides };

      set({
        user,
        plan,
        limits,
        loading: false,
      });
    } catch (error) {
      console.error('Error in loadProfileAndLimits:', error);
      set({ loading: false });
    }
  },
  
  loadDailyUsage: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      // Use rpc or direct query - usage_events table will be created by edge functions
      const { count, error } = await supabase
        .from('usage_events' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString());
      
      if (error) {
        // Table might not exist yet, that's ok
        console.log('Usage events table not ready yet:', error.message);
        set({ dailyUsed: 0 });
        return;
      }
      
      set({ dailyUsed: count || 0 });
    } catch (error) {
      console.error('Error in loadDailyUsage:', error);
      set({ dailyUsed: 0 });
    }
  },
  
  refreshAfterBilling: async () => {
    await get().loadProfileAndLimits();
    await get().loadDailyUsage();
  },
  
  reset: () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('defaultBrandVoiceSelection');
      }
    } catch (err) {
      console.error('Failed to clear stored brand voice selection', err);
    }
    
    set({
      user: null,
      plan: 'free',
      limits: DEFAULT_LIMITS,
      dailyUsed: 0,
      loading: false,
      brandVoiceSelection: null,
    });
  },
}));
