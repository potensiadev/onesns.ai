export type PlanName = "free" | "pro" | string;

export type LimitsConfig = {
  daily_generations: number | null;
  max_platforms_per_request: number | null;
  brand_voice: boolean;
  blog_to_sns: boolean;
  max_blog_length: number | null;
  variations_per_request: number | null;
  history_limit: number | null;
  priority_routing: boolean;
  rate_limit?: { requests_per_hour: number } | null;
};

export const MVP_LIMITS: Record<"free" | "pro", LimitsConfig> = {
  free: {
    daily_generations: 5,
    max_platforms_per_request: 1,
    brand_voice: false,
    blog_to_sns: true,
    max_blog_length: 2000,
    variations_per_request: 1,
    history_limit: 50,
    priority_routing: false,
  },
  pro: {
    daily_generations: null,
    max_platforms_per_request: 6,
    brand_voice: true,
    blog_to_sns: true,
    max_blog_length: null,
    variations_per_request: null,
    history_limit: null,
    priority_routing: true,
  },
};

export const PMF_READY_LIMITS: Record<"free" | "pro", LimitsConfig> = {
  free: {
    daily_generations: 3,
    max_platforms_per_request: 1,
    brand_voice: false,
    blog_to_sns: false,
    max_blog_length: 0,
    variations_per_request: 1,
    history_limit: 20,
    priority_routing: false,
    rate_limit: { requests_per_hour: 15 },
  },
  pro: {
    daily_generations: 200,
    max_platforms_per_request: 5,
    brand_voice: true,
    blog_to_sns: true,
    max_blog_length: 20000,
    variations_per_request: 10,
    history_limit: 2000,
    priority_routing: true,
    rate_limit: { requests_per_hour: 1000 },
  },
};
