-- Create generations table for storing generated content
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('idea', 'blog')),
  topic TEXT,
  content TEXT NOT NULL,
  tone TEXT,
  platforms TEXT[] NOT NULL,
  outputs JSONB NOT NULL,
  variant_type TEXT NOT NULL DEFAULT 'original' CHECK (variant_type IN ('original', 'variation')),
  parent_generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for user lookups
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX idx_generations_parent ON public.generations(parent_generation_id);

-- Enable RLS
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own generations"
  ON public.generations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations"
  ON public.generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations"
  ON public.generations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generations"
  ON public.generations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create brand_voices table for storing brand voice configurations
CREATE TABLE IF NOT EXISTS public.brand_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  extracted_style JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for user lookups
CREATE INDEX idx_brand_voices_user_id ON public.brand_voices(user_id);

-- Enable RLS
ALTER TABLE public.brand_voices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own brand voices"
  ON public.brand_voices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brand voices"
  ON public.brand_voices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand voices"
  ON public.brand_voices
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brand voices"
  ON public.brand_voices
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_brand_voices_updated_at
  BEFORE UPDATE ON public.brand_voices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create usage_events table for tracking usage
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for user and date lookups
CREATE INDEX idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX idx_usage_events_created_at ON public.usage_events(created_at DESC);
CREATE INDEX idx_usage_events_user_date ON public.usage_events(user_id, created_at);

-- Enable RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage events"
  ON public.usage_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert usage events (edge functions use service role)
CREATE POLICY "Service role can insert usage events"
  ON public.usage_events
  FOR INSERT
  WITH CHECK (true);