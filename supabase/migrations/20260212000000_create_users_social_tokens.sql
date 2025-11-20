-- Table for storing encrypted social tokens per provider
CREATE TABLE public.users_social_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('facebook', 'instagram', 'threads')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  long_lived_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  long_lived_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'connected',
  needs_reconnect BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.users_social_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social tokens"
ON public.users_social_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social tokens"
ON public.users_social_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social tokens"
ON public.users_social_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social tokens"
ON public.users_social_tokens
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_users_social_tokens_user_provider ON public.users_social_tokens(user_id, provider);

CREATE TRIGGER update_users_social_tokens_updated_at
BEFORE UPDATE ON public.users_social_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
