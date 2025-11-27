import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionResponse<T = any> {
  data?: T;
  error?: string;
}

export async function callEdgeFunction<T = any>(
  functionName: string,
  body?: Record<string, any>
): Promise<EdgeFunctionResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body || {},
    });

    if (error) {
      console.error(`Edge function ${functionName} error:`, error);
      return { error: error.message || 'Unknown error occurred' };
    }

    return { data };
  } catch (err) {
    console.error(`Edge function ${functionName} exception:`, err);
    return { error: err instanceof Error ? err.message : 'Unknown error occurred' };
  }
}

// Typed edge function calls
export const edgeFunctions = {
  generatePost: (body: {
    type: 'simple';
    topic: string;
    content: string;
    tone: string;
    platforms: string[];
    brandVoiceId?: string | null;
  }) => callEdgeFunction('generate-post', body),
  
  generateVariations: (body: {
    originalContent: string;
    platform: string;
    count: number;
  }) => callEdgeFunction('generate-variations', body),
  
  blogToSns: (body: {
    type: 'blog';
    blogContent: string;
    platforms: string[];
    brandVoiceId?: string | null;
  }) => callEdgeFunction('generate-post', body),
  
  extractBrandVoice: (body: {
    sampleContent: string;
  }) => callEdgeFunction('brand-voice-extract', body),
};
