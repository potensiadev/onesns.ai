# CLAUDE.md - AI Assistant Guide for SocialSparkle

## Project Overview

**SocialSparkle** is an AI-powered multi-platform social media content generation tool that transforms user input into platform-optimized posts for Twitter, Instagram, Reddit, Threads, and Pinterest. The application supports two modes: simple topic-based generation and blog post conversion.

**Key Capabilities:**
- Generate platform-specific content from a single input
- Convert blog posts into engaging social media content
- Manage social media account connections and tokens
- Publish directly to supported platforms (Twitter, Threads)
- Secure token encryption with AES-256-GCM

**Project Type:** Production web application (built with Lovable)
**Deployment:** Supabase + Vercel/Netlify
**Primary Branch:** Based on session, follows pattern `claude/*-<session-id>`

---

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript** - Type safety (strict mode enabled)
- **Vite** - Build tool with SWC for fast refresh
- **React Router v6** - Client-side routing
- **TanStack Query v5** - Server state management with optimistic updates
- **shadcn/ui + Radix UI** - Component library (New York variant, Slate theme)
- **Tailwind CSS** - Styling with custom design tokens
- **Zod** - Runtime validation for forms and API boundaries
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Backend
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database with auto-generated types
  - Row-Level Security (RLS) policies
  - Supabase Auth (JWT-based sessions)
  - Edge Functions (Deno runtime)
- **OpenAI GPT-4o-mini** - Primary AI provider for content generation
- **Google Gemini** - Alternative AI provider (available but not default)

### External Integrations
- Twitter API v2
- Meta Threads API
- Instagram, Reddit, Pinterest (placeholder implementations)

---

## Directory Structure

```
/home/user/socialsparkle/
├── src/                              # Frontend application source
│   ├── components/                   # React components
│   │   ├── ui/                      # shadcn/ui primitives (auto-generated)
│   │   ├── AuthModal.tsx            # Login/signup modal
│   │   ├── AuthProvider.tsx         # Global auth context
│   │   ├── BlogContentForm.tsx      # Blog-to-social conversion form
│   │   ├── ContentForm.tsx          # Simple topic-based content form
│   │   ├── Hero.tsx                 # Landing page hero with navigation
│   │   ├── NavLink.tsx              # Navigation link component
│   │   ├── ProtectedRoute.tsx       # Auth wrapper for protected routes
│   │   ├── ResultCards.tsx          # Display and publish generated content
│   │   ├── SocialAccountCard.tsx    # Social account connection UI
│   │   └── UserMenu.tsx             # User dropdown menu
│   ├── pages/                       # Route-level page components
│   │   ├── Index.tsx                # Home page (main content generator)
│   │   ├── Auth.tsx                 # Login/signup page
│   │   ├── Connections.tsx          # Social media account connections
│   │   ├── TokenManagement.tsx      # Manual token CRUD interface
│   │   └── NotFound.tsx             # 404 error page
│   ├── hooks/                       # Custom React hooks
│   │   ├── use-toast.ts             # Toast notification hook
│   │   └── use-mobile.tsx           # Mobile detection hook
│   ├── integrations/supabase/       # Supabase integration
│   │   ├── client.ts                # Supabase client initialization
│   │   ├── types.ts                 # Auto-generated database types
│   │   └── auth-utils.ts            # Session refresh & token management
│   ├── lib/                         # Utility libraries
│   │   └── utils.ts                 # Helper functions (cn utility)
│   ├── App.tsx                      # Root component with routing
│   ├── main.tsx                     # Application entry point
│   └── index.css                    # Global styles & CSS variables
│
├── supabase/                        # Supabase backend
│   ├── functions/                   # Edge Functions (Deno runtime)
│   │   ├── generate-post/          # AI content generation
│   │   │   ├── index.ts            # Main implementation (OpenAI)
│   │   │   ├── index-openai.ts     # OpenAI implementation
│   │   │   ├── index-gemini.ts     # Gemini alternative
│   │   │   └── _shared/            # Shared utilities
│   │   ├── publish-post/           # Social media publishing
│   │   │   ├── index.ts            # Multi-platform publishing logic
│   │   │   └── _shared/            # Shared utilities
│   │   ├── encrypt-token/          # Token encryption
│   │   │   ├── index.ts            # AES-256-GCM encryption
│   │   │   └── _shared/            # Shared utilities
│   │   └── _shared/
│   │       └── encryption.ts       # Shared encryption functions
│   └── migrations/                  # Database migrations
│       ├── 20251109015743_*.sql    # Initial social_accounts table
│       ├── 20251109025452_*.sql    # Profiles setup
│       ├── 20251109032112_*.sql    # Additional RLS policies
│       └── 20251109041500_*.sql    # Profile delete policy
│
├── public/                          # Static assets
├── .env.example                     # Environment variables template
├── package.json                     # Dependencies and scripts
├── vite.config.ts                  # Vite configuration
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── components.json                 # shadcn/ui configuration
└── eslint.config.js                # ESLint configuration
```

---

## Database Schema

### Tables

#### `social_accounts`
Stores encrypted social media account credentials.

```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'reddit', 'threads', 'pinterest')),
  account_name TEXT,
  access_token TEXT NOT NULL,        -- Encrypted with AES-256-GCM
  refresh_token TEXT,                -- Encrypted with AES-256-GCM
  token_expires_at TIMESTAMPTZ,      -- Token expiration datetime
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)          -- One account per platform per user
);
```

**RLS Policies:**
- Users can only SELECT/INSERT/UPDATE/DELETE their own accounts
- Automatic filtering by `auth.uid() = user_id`

#### `profiles`
User profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- Users can only manage their own profile

### Type Generation
Database types are auto-generated in `src/integrations/supabase/types.ts`. To regenerate:
```bash
npx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

---

## Key Architectural Patterns

### 1. Component Architecture
- **Atomic Design**: UI components (`ui/`) separated from composite components
- **Container/Presentational**: Pages handle data fetching, components handle UI
- **Compound Components**: Forms combine multiple primitives for cohesive UX

### 2. State Management
- **Server State**: TanStack Query for data fetching, caching, and optimistic updates
- **Auth State**: React Context (`AuthProvider`) for global session management
- **Form State**: Controlled components with `useState`
- **UI State**: Local `useState` for modals, loading states, etc.
- **URL State**: React Router for navigation and route parameters

**No Redux or Zustand** - Prefer React Query + Context for simplicity.

### 3. Authentication Flow
1. User logs in via `Auth.tsx` (email/password)
2. Supabase Auth creates JWT session stored in localStorage
3. `AuthProvider` manages global session state
4. Automatic token refresh every 4 minutes via interval
5. Proactive refresh 5 minutes before token expiry
6. `ProtectedRoute` wrapper redirects unauthenticated users to `/auth`

**Session Management** (`src/integrations/supabase/auth-utils.ts`):
- `ensureFreshSession()`: Checks and refreshes tokens before API calls
- Handles network errors with retries
- Detects auth errors (401, 403, expired tokens)
- Prompts user to re-login when session cannot be recovered

### 4. Data Flow Pattern
```
User Action → Form Validation (Zod) → Optimistic Update → API Call →
Edge Function → Database → Response → Cache Update → UI Update
```

For mutations:
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    await ensureFreshSession(); // Ensure valid token
    const { data: result, error } = await supabase
      .from('social_accounts')
      .insert(data);
    if (error) throw error;
    return result;
  },
  onMutate: async (newData) => {
    // Optimistic update
    await queryClient.cancelQueries({ queryKey: ['social-accounts'] });
    const previous = queryClient.getQueryData(['social-accounts']);
    queryClient.setQueryData(['social-accounts'], (old) => [...old, newData]);
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['social-accounts'], context.previous);
    toast.error('Failed to save account');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    toast.success('Account saved successfully');
  }
});
```

### 5. Security Patterns

**Token Encryption:**
1. User enters access token in `TokenManagement.tsx`
2. Frontend calls `encrypt-token` Edge Function
3. Edge Function encrypts with AES-256-GCM using `ENCRYPTION_KEY`
4. Encrypted token stored in database
5. On publish, `publish-post` decrypts token using shared encryption utility
6. Decrypted token used for API call, never logged or exposed

**Row-Level Security (RLS):**
All queries automatically filtered by `user_id`:
```sql
-- Example RLS policy
CREATE POLICY "Users can view own accounts"
ON social_accounts FOR SELECT
USING (auth.uid() = user_id);
```

**Edge Function Authorization:**
All Edge Functions require Bearer token in Authorization header:
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Missing authorization' }), {
    status: 401,
  });
}
```

---

## Edge Functions

### 1. `generate-post`
**Purpose:** Generate platform-optimized social media posts using AI.

**Location:** `supabase/functions/generate-post/index.ts`

**Input Validation:**
```typescript
const schema = z.object({
  mode: z.enum(['simple', 'blog']),
  topic: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(3000).optional(), // Simple mode: max 3000 chars
  blogContent: z.string().min(1).max(10000).optional(), // Blog mode: max 10000 chars
  keyMessage: z.string().min(1).max(500).optional(),
  tone: z.string().min(1).max(100),
  platforms: z.array(z.enum(['twitter', 'instagram', 'reddit', 'threads', 'pinterest']))
    .min(1)
    .max(5)
});
```

**Character Limits (Important!):**
- Simple mode content: 1-3000 characters
- Blog mode content: 1-10,000 characters
- Topic: 1-200 characters
- Key message: 1-500 characters
- Platforms: 1-5 selections

**AI Provider:** OpenAI GPT-4o-mini (configurable to Gemini)

**Platform-Specific Prompts:**
Each platform has custom character limits and style guidelines:
- **Twitter**: 280 chars, conversational, hashtags, emoji
- **Instagram**: 2200 chars, visual storytelling, emoji, hashtags
- **Reddit**: 10000 chars, detailed, authentic, minimal emoji
- **Threads**: 500 chars, personal, conversational
- **Pinterest**: 500 chars, descriptive, inspirational

**Response Format:**
```json
{
  "posts": {
    "twitter": "Generated tweet content...",
    "instagram": "Generated Instagram caption...",
    "reddit": "Generated Reddit post...",
    "threads": "Generated Threads post...",
    "pinterest": "Generated Pinterest description..."
  }
}
```

**Error Handling:**
- Rate limit errors: Returns 429 with retry message
- Credit errors: Returns 402 with upgrade message
- Validation errors: Returns 400 with details
- Server errors: Returns 500 with generic message

### 2. `encrypt-token`
**Purpose:** Encrypt social media access tokens before database storage.

**Location:** `supabase/functions/encrypt-token/index.ts`

**Algorithm:** AES-256-GCM with random IV per encryption

**Input:**
```typescript
{
  accessToken: string,  // 10-4000 chars
  refreshToken?: string // 10-4000 chars
}
```

**Output:**
```typescript
{
  success: true,
  encrypted_access_token: "base64_iv:base64_ciphertext",
  encrypted_refresh_token?: "base64_iv:base64_ciphertext"
}
```

**Environment Required:** `ENCRYPTION_KEY` (32-byte base64-encoded key)

**Generate Key:**
```bash
openssl rand -base64 32
```

### 3. `publish-post`
**Purpose:** Publish generated content to social media platforms.

**Location:** `supabase/functions/publish-post/index.ts`

**Input:**
```typescript
{
  platform: 'twitter' | 'instagram' | 'reddit' | 'threads' | 'pinterest',
  content: string,
  accountId: string  // UUID from social_accounts table
}
```

**Platform Support:**
- **Twitter**: Fully implemented (POST /2/tweets)
- **Threads**: Fully implemented (two-step creation + publish)
- **Instagram**: Not supported (requires media upload)
- **Reddit**: Not implemented (requires subreddit)
- **Pinterest**: Not implemented (requires board + image)

**Flow:**
1. Validate user owns account (RLS policy check)
2. Fetch account from database
3. Decrypt access token using shared encryption utility
4. Check token expiration (`token_expires_at`)
5. Make platform API call with decrypted token
6. Return success/error response

**Error Handling:**
- Expired tokens: Returns 401 with re-authentication message
- API errors: Returns platform-specific error messages
- Decryption errors: Falls back to plaintext (migration support)

---

## Development Workflows

### Environment Setup

1. **Clone and Install:**
```bash
git clone <repo-url>
cd socialsparkle
npm install  # or bun install
```

2. **Configure Environment Variables:**
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

3. **Start Development Server:**
```bash
npm run dev  # Runs on http://localhost:8080
```

### Available Scripts

```bash
npm run dev           # Start Vite dev server (port 8080)
npm run build         # Production build
npm run build:dev     # Development build with sourcemaps
npm run lint          # Run ESLint
npm run preview       # Preview production build
```

### Code Quality Checks

**Before committing:**
```bash
npm run lint          # Check for linting errors
npm run build         # Ensure build succeeds
```

**TypeScript Strict Mode:**
All code must pass strict type checking. No `any` types without justification.

### Working with Supabase

**Local Development:**
```bash
npx supabase start              # Start local Supabase
npx supabase db reset           # Reset local database
npx supabase functions serve    # Serve Edge Functions locally
```

**Deploying Edge Functions:**
```bash
npx supabase functions deploy generate-post
npx supabase functions deploy encrypt-token
npx supabase functions deploy publish-post
```

**Set Edge Function Secrets:**
```bash
npx supabase secrets set ENCRYPTION_KEY=<base64-key>
npx supabase secrets set OPENAI_API_KEY=<api-key>
```

### Testing Changes

**Manual Testing Checklist:**
1. Test authentication (login, signup, logout)
2. Test content generation (simple and blog modes)
3. Test token management (add, edit, delete)
4. Test publishing to available platforms
5. Test error handling (expired tokens, API errors)
6. Test responsive design (mobile, tablet, desktop)

**No Automated Tests:**
Currently, there are no unit or integration tests. When adding features, manual testing is required.

---

## Important Conventions & Best Practices

### 1. File Naming
- **Components**: PascalCase (e.g., `AuthModal.tsx`)
- **Utilities**: kebab-case (e.g., `auth-utils.ts`)
- **Hooks**: kebab-case with `use-` prefix (e.g., `use-toast.ts`)
- **Types**: PascalCase for interfaces/types (e.g., `Database`)

### 2. Import Patterns
Use path aliases for clean imports:
```typescript
// Good
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Avoid
import { supabase } from '../../../integrations/supabase/client';
```

### 3. Component Structure
```typescript
// Standard component structure
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
  const [loading, setLoading] = React.useState(false);

  const { data, error } = useQuery({
    queryKey: ['my-data'],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select('*');
      if (error) throw error;
      return data;
    }
  });

  const handleClick = async () => {
    setLoading(true);
    try {
      await onSubmit();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2>{title}</h2>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Submit'}
      </Button>
    </div>
  );
};
```

### 4. Error Handling
Always handle errors gracefully with user-friendly messages:

```typescript
try {
  const result = await someOperation();
} catch (error) {
  console.error('Operation failed:', error);
  toast({
    title: 'Error',
    description: 'Something went wrong. Please try again.',
    variant: 'destructive'
  });
}
```

### 5. Validation with Zod
All user inputs and API boundaries should use Zod schemas:

```typescript
import { z } from 'zod';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  platform: z.enum(['twitter', 'instagram', 'reddit', 'threads', 'pinterest'])
});

type FormData = z.infer<typeof formSchema>;

// In component
const handleSubmit = (data: FormData) => {
  const validation = formSchema.safeParse(data);
  if (!validation.success) {
    toast.error(validation.error.errors[0].message);
    return;
  }
  // Proceed with validated data
};
```

### 6. Styling with Tailwind
Use Tailwind utility classes with `cn()` helper for conditional styles:

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes here",
  isActive && "active-classes",
  isError && "error-classes"
)} />
```

**Custom Tokens Available:**
- Platform colors: `bg-twitter`, `bg-instagram`, `bg-reddit`, `bg-threads`, `bg-pinterest`
- Gradients: `bg-gradient-primary`, `bg-gradient-hero`, `bg-gradient-card`
- Shadows: `shadow-glow`
- Dark mode: Use `dark:` prefix (e.g., `dark:bg-gray-800`)

### 7. Database Operations
Always handle Supabase errors and ensure fresh session:

```typescript
import { ensureFreshSession } from '@/integrations/supabase/auth-utils';

const saveAccount = async (data) => {
  await ensureFreshSession(); // Refresh token if needed

  const { data: result, error } = await supabase
    .from('social_accounts')
    .insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      ...data
    });

  if (error) {
    console.error('Database error:', error);
    throw new Error('Failed to save account');
  }

  return result;
};
```

### 8. Edge Function Patterns
All Edge Functions follow this structure:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Business logic here
    const result = await processRequest(validation.data);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Common Tasks & How-To Guide

### Adding a New Social Platform

1. **Update Database Schema:**
```sql
-- Add platform to check constraint
ALTER TABLE social_accounts
DROP CONSTRAINT social_accounts_platform_check,
ADD CONSTRAINT social_accounts_platform_check
CHECK (platform IN ('twitter', 'instagram', 'reddit', 'threads', 'pinterest', 'newplatform'));
```

2. **Update Types:**
Regenerate database types after schema change.

3. **Add Platform Configuration:**
In `src/pages/Connections.tsx`, add platform details:
```typescript
const platforms = [
  // ... existing platforms
  {
    id: 'newplatform',
    name: 'New Platform',
    icon: NewPlatformIcon,
    color: 'bg-newplatform',
    description: 'Connect your New Platform account'
  }
];
```

4. **Add Tailwind Color:**
In `tailwind.config.ts`:
```typescript
colors: {
  newplatform: '#HEX_COLOR',
}
```

5. **Implement Publishing Logic:**
In `supabase/functions/publish-post/index.ts`:
```typescript
case 'newplatform':
  const newPlatformResponse = await fetch('https://api.newplatform.com/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${decryptedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!newPlatformResponse.ok) throw new Error('Failed to publish');
  break;
```

6. **Add Platform Prompt:**
In `supabase/functions/generate-post/index.ts`:
```typescript
const platformPrompts = {
  // ... existing platforms
  newplatform: `Create a post for New Platform (max ${charLimit} characters).
    Style: [describe platform style]
    Include: [platform-specific elements]`
};
```

### Adding a New Page

1. **Create Page Component:**
```typescript
// src/pages/MyNewPage.tsx
import React from 'react';

export default function MyNewPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">My New Page</h1>
    </div>
  );
}
```

2. **Add Route:**
In `src/App.tsx`:
```typescript
import MyNewPage from './pages/MyNewPage';

// In Routes component
<Route path="/my-new-page" element={<MyNewPage />} />
```

3. **Add Navigation Link:**
In `src/components/Hero.tsx` or relevant component:
```typescript
<NavLink to="/my-new-page">My New Page</NavLink>
```

### Modifying Content Generation Prompts

**Location:** `supabase/functions/generate-post/index.ts`

Find the `platformPrompts` object and modify:
```typescript
const platformPrompts: Record<Platform, string> = {
  twitter: `Create a tweet (max ${twitterLimit} characters).

    UPDATED GUIDELINES:
    - More emphasis on questions
    - Use thread format for longer content
    - Include call-to-action
    - Emoji at start and end only

    Topic: ${topic}
    Content: ${content}
    Tone: ${tone}`,

  // ... other platforms
};
```

**After modifying:** Redeploy the function:
```bash
npx supabase functions deploy generate-post
```

### Debugging Authentication Issues

**Common Issues:**

1. **Session Expired:**
```typescript
// Check session status
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Manually refresh
const { data, error } = await supabase.auth.refreshSession();
console.log('Refresh result:', data, error);
```

2. **Token Refresh Not Working:**
Check `src/integrations/supabase/auth-utils.ts`:
- Ensure `ensureFreshSession()` is called before API operations
- Check that refresh interval is running in `AuthProvider`
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct

3. **RLS Policy Blocking Query:**
```sql
-- Check current user ID
SELECT auth.uid();

-- Test query with RLS disabled (as service role)
SELECT * FROM social_accounts WHERE user_id = 'user-uuid';
```

### Adding Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: async (newData) => {
    const { data, error } = await supabase
      .from('social_accounts')
      .insert(newData);
    if (error) throw error;
    return data;
  },
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['social-accounts'] });

    // Snapshot previous value
    const previousAccounts = queryClient.getQueryData(['social-accounts']);

    // Optimistically update cache
    queryClient.setQueryData(['social-accounts'], (old: any[]) => {
      return [...old, newData];
    });

    // Return context with snapshot
    return { previousAccounts };
  },
  onError: (err, newData, context) => {
    // Rollback to previous value on error
    queryClient.setQueryData(['social-accounts'], context?.previousAccounts);
    toast.error('Failed to add account');
  },
  onSettled: () => {
    // Refetch to sync with server
    queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
  },
});
```

---

## Important Gotchas & Considerations

### 1. Character Limits Are Enforced
Recent commits show adjustments to character limits. **Always respect these limits:**
- Simple mode content: **3000 characters max**
- Blog mode content: **10,000 characters max**
- Topic: **200 characters max**

Validation is enforced in both frontend and backend (Edge Function). Changes to limits require updates in **both locations**.

### 2. Token Encryption is Mandatory
All social media tokens **must** be encrypted before storage:
- Never store plaintext tokens in `social_accounts` table
- Always call `encrypt-token` Edge Function before INSERT/UPDATE
- `ENCRYPTION_KEY` environment variable must be set in Supabase Edge Functions
- Decryption happens server-side only in `publish-post` function

### 3. Session Refresh is Critical
Sessions expire after 1 hour (Supabase default). The application implements:
- Automatic refresh every 4 minutes (background interval)
- Proactive refresh 5 minutes before expiry
- Manual `ensureFreshSession()` before sensitive operations

**When adding new API calls**, always call `ensureFreshSession()` first:
```typescript
await ensureFreshSession();
const { data } = await supabase.from('table').select();
```

### 4. RLS Policies Filter All Queries
All database queries are automatically filtered by `user_id`:
- Users cannot see other users' data
- No need to manually add `WHERE user_id = ...` clauses
- When inserting, **always** include `user_id` field

### 5. Platform Publishing Limitations
Not all platforms are fully implemented:
- **Twitter**: ✅ Fully working
- **Threads**: ✅ Fully working
- **Instagram**: ❌ Requires media upload (not implemented)
- **Reddit**: ❌ Requires subreddit selection (not implemented)
- **Pinterest**: ❌ Requires board and image (not implemented)

When users try to publish to unsupported platforms, show appropriate error messages.

### 6. Environment Variables Must Be Validated
The application validates environment variables at startup (`src/integrations/supabase/client.ts`):
- Missing or invalid `VITE_SUPABASE_URL` causes immediate failure
- Missing `VITE_SUPABASE_PUBLISHABLE_KEY` causes immediate failure
- URL must be valid HTTPS format

**For deployment**, ensure environment variables are set in hosting platform (Vercel, Netlify, etc.).

### 7. Edge Functions Require CORS Headers
All Edge Functions must include CORS headers for browser requests:
```typescript
headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

Handle OPTIONS preflight requests separately.

### 8. Lovable Auto-Commits
This project is built with Lovable, which automatically commits changes:
- Commit messages may be generic ("Changes")
- Check recent commits to understand what was changed
- Manual commits should follow conventional commit format

### 9. No Testing Framework
There are no automated tests. When making changes:
- Manually test all affected functionality
- Test error cases (network errors, expired tokens, validation errors)
- Test on multiple screen sizes (responsive design)
- Verify in different browsers

### 10. OpenAI Rate Limits
The `generate-post` function uses OpenAI GPT-4o-mini:
- Rate limits apply based on OpenAI API key tier
- Handle 429 errors gracefully with user-friendly messages
- Consider implementing retry logic for transient errors

---

## Git Workflow

### Branch Strategy
- **Feature Branches**: `claude/<descriptive-name>-<session-id>`
- **Main Branch**: Based on project configuration (check README)
- Always develop on designated feature branch
- Never push directly to main without explicit permission

### Commit Guidelines
```bash
# Good commit messages (conventional commits)
git commit -m "feat: Add Pinterest platform support"
git commit -m "fix: Correct token expiration validation"
git commit -m "refactor: Extract platform publishing logic"
git commit -m "docs: Update CLAUDE.md with new patterns"

# Generic commits (auto-generated by Lovable)
git commit -m "Changes"  # Acceptable but not preferred
```

### Pushing Changes
```bash
# Always use -u flag for new branches
git push -u origin claude/feature-name-session-id

# Retry on network errors with exponential backoff
# (up to 4 retries: 2s, 4s, 8s, 16s)
```

---

## Performance Considerations

### Current Optimizations
- Vite with SWC for fast builds and HMR
- TanStack Query for request deduplication and caching
- Optimistic updates for instant UI feedback
- Lazy loading opportunities (not currently implemented)

### Potential Improvements
1. **Code Splitting**: Use `React.lazy()` for route-based splitting
2. **Image Optimization**: Implement lazy loading for images
3. **Memoization**: Use `useMemo` and `useCallback` for expensive operations
4. **Virtualization**: For long lists (if needed)
5. **Bundle Analysis**: Run `npm run build` and analyze bundle size

---

## Security Checklist

When making changes, ensure:
- [ ] No sensitive data in error messages or logs
- [ ] All user inputs validated with Zod schemas
- [ ] SQL injection prevented (using Supabase query builder)
- [ ] XSS prevented (React auto-escapes, but verify for `dangerouslySetInnerHTML`)
- [ ] CSRF protected (Supabase handles this)
- [ ] Tokens encrypted before storage (AES-256-GCM)
- [ ] RLS policies applied to all tables
- [ ] Edge Functions require authentication
- [ ] Environment variables not exposed to client (except `VITE_*` prefixed)
- [ ] HTTPS enforced in production

---

## Deployment

### Frontend (Vercel/Netlify)
1. Connect GitHub repository
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy

### Edge Functions (Supabase)
```bash
# Deploy all functions
npx supabase functions deploy generate-post
npx supabase functions deploy encrypt-token
npx supabase functions deploy publish-post

# Set secrets
npx supabase secrets set ENCRYPTION_KEY=<base64-key>
npx supabase secrets set OPENAI_API_KEY=<api-key>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Database (Supabase)
Migrations are automatically applied in Supabase Dashboard or via CLI:
```bash
npx supabase db push
```

---

## AI Assistant Guidelines

### When Making Changes
1. **Read before writing**: Always read files before editing
2. **Validate before saving**: Ensure TypeScript compiles
3. **Test manually**: No automated tests exist
4. **Update types**: Regenerate database types if schema changes
5. **Update docs**: Keep this CLAUDE.md file updated
6. **Respect limits**: Follow character limits and validation rules
7. **Handle errors**: Add proper error handling for all operations
8. **Check auth**: Ensure session is fresh before API calls
9. **Follow patterns**: Use existing patterns for consistency
10. **Ask if unsure**: Clarify requirements before major changes

### Code Review Checklist
Before completing a task, verify:
- [ ] TypeScript compiles without errors
- [ ] ESLint passes (run `npm run lint`)
- [ ] No console errors in browser
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Error states handled gracefully
- [ ] Loading states shown for async operations
- [ ] Toast notifications for user feedback
- [ ] Code follows existing patterns
- [ ] Comments added for complex logic
- [ ] No sensitive data exposed

### Communication Style
- **Be concise**: Users appreciate brevity
- **Show, don't tell**: Provide code examples
- **Explain trade-offs**: Mention pros/cons of approaches
- **Link to docs**: Reference official documentation when relevant
- **Use code references**: Include file paths and line numbers (e.g., `src/App.tsx:42`)

---

## Resources & Documentation

### Official Documentation
- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/
- **TanStack Query**: https://tanstack.com/query/latest
- **Supabase**: https://supabase.com/docs
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Zod**: https://zod.dev/

### API References
- **Twitter API v2**: https://developer.twitter.com/en/docs/twitter-api
- **Threads API**: https://developers.facebook.com/docs/threads
- **OpenAI API**: https://platform.openai.com/docs/api-reference

### Internal References
- **Database Types**: `src/integrations/supabase/types.ts`
- **Supabase Client**: `src/integrations/supabase/client.ts`
- **Auth Utilities**: `src/integrations/supabase/auth-utils.ts`
- **UI Components**: `src/components/ui/` (auto-generated by shadcn)

---

## Changelog

### Recent Updates (Based on Git History)
- **2025-11-19**: Adjusted content length validation (blog: 10000, simple: 3000)
- **2025-11-18**: Enhanced authentication with session management and retry logic
- **2025-11-17**: Added robust signup error handling with detailed 422 messages
- **2025-11-16**: Changed main page to public with auth modal on content generation
- **2025-11-15**: Limited platforms to max 5 selections in generate-post

### Document Version
**Version:** 1.0
**Last Updated:** 2025-11-19
**Maintained By:** AI Assistants (Claude)

---

## Questions & Support

### Common Questions

**Q: Why are tokens encrypted?**
A: Social media access tokens are sensitive credentials. Encryption prevents unauthorized access even if the database is compromised.

**Q: Why does session refresh happen so frequently?**
A: Supabase JWT tokens expire after 1 hour. Proactive refreshing (every 4 minutes) ensures seamless UX without sudden logouts.

**Q: Can I use a different AI provider?**
A: Yes! The `generate-post` function has both OpenAI and Gemini implementations. Switch by changing the import in `index.ts`.

**Q: Why are some platforms not fully implemented?**
A: Instagram, Reddit, and Pinterest require additional data (media, subreddit, board) that's not yet supported in the UI.

**Q: How do I add a new feature?**
A: Follow the patterns in existing code, update relevant files, test manually, and update this documentation.

### Getting Help
- Check this documentation first
- Review existing code for similar patterns
- Check official documentation for libraries/APIs
- Test changes manually before committing

---

*This document should be kept up-to-date as the codebase evolves. AI assistants should update relevant sections when making significant changes.*
