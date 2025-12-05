-- Ensure profiles table has limits column for plan gating
alter table public.profiles
  add column if not exists limits jsonb default '{}'::jsonb;
