import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PlatformSelector } from '@/components/PlatformSelector';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAppStore } from '@/store/useAppStore';
import { edgeFunctions } from '@/api/edgeFunctions';
import { toast } from 'sonner';
import { Sparkles, AlertCircle, FileText, Link as LinkIcon, Copy, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GeneratedContent, ResultCards } from '@/components/ResultCards';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UpgradeToProModal } from '@/components/UpgradeToProModal';

// Validation schemas
const blogContentSchema = z.string()
  .min(10, 'Blog content must be at least 10 characters')
  .max(50000, 'Blog content must be less than 50,000 characters');

const urlSchema = z.string()
  .url('Please enter a valid URL')
  .max(2048, 'URL is too long');

// Variation Card Component
function VariationCard({ style, text }: { style: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${style} variation copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatStyleLabel = (style: string) => {
    return style
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-card hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-medium text-sm">{formatStyleLabel(style)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-3"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export default function Create() {
  const {
    brandVoiceAllowed,
    maxPlatforms,
    maxBlogLength,
    dailyUsed,
    limits,
    loadDailyUsage,
    brandVoiceSelection,
    plan,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('create');
  const navigate = useNavigate();
  
  // Multi-platform form state
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [useBrandVoice, setUseBrandVoice] = useState(!!brandVoiceSelection);
  
  // Blog-to-SNS form state
  const [blogSourceType, setBlogSourceType] = useState<'text' | 'url'>('text');
  const [blogUrl, setBlogUrl] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogTone, setBlogTone] = useState('');
  const [blogPlatforms, setBlogPlatforms] = useState<string[]>([]);
  const [blogUseBrandVoice, setBlogUseBrandVoice] = useState(!!brandVoiceSelection);
  
  // Variations form state
  const [baseText, setBaseText] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [variationResults, setVariationResults] = useState<Record<string, string> | null>(null);
  const [variationUseBrandVoice, setVariationUseBrandVoice] = useState(!!brandVoiceSelection);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [upgradeTitle, setUpgradeTitle] = useState('Upgrade to Pro');
  const [results, setResults] = useState<GeneratedContent | null>(null);

  const isAtDailyLimit = limits.daily_generations !== null && dailyUsed >= limits.daily_generations;
  const defaultBrandVoiceId = brandVoiceAllowed && brandVoiceSelection ? brandVoiceSelection.id : null;
  const platformLimitExceeded = maxPlatforms !== null && platforms.length > maxPlatforms;
  const blogPlatformLimitExceeded = maxPlatforms !== null && blogPlatforms.length > maxPlatforms;
  const variationsLimit = limits.variations_per_request ?? null;
  const variationsLimitExceeded = variationsLimit !== null && selectedStyles.length > variationsLimit;

  useEffect(() => {
    const enabled = brandVoiceAllowed && !!brandVoiceSelection;
    setUseBrandVoice(enabled);
    setBlogUseBrandVoice(enabled);
    setVariationUseBrandVoice(enabled);
  }, [brandVoiceAllowed, brandVoiceSelection]);

  useEffect(() => {
    if (blogSourceType === 'text' && maxBlogLength !== null && blogContent.length > maxBlogLength) {
      setUpgradeTitle('Blog Length Limit');
      setUpgradeReason(`Free users can repurpose up to ${maxBlogLength.toLocaleString()} characters.`);
      setShowUpgradeModal(true);
    }
  }, [blogContent, blogSourceType, maxBlogLength]);

  const canGenerate = !isAtDailyLimit && !platformLimitExceeded && platforms.length > 0 && (topic || content);

  const handlePlatformChange = (newPlatforms: string[]) => {
    if (maxPlatforms !== null && newPlatforms.length > maxPlatforms) {
      setUpgradeTitle('Platform Limit Reached');
      setUpgradeReason(`Free users can generate content for up to ${maxPlatforms} platform${maxPlatforms === 1 ? '' : 's'}.`);
      setShowUpgradeModal(true);
      return;
    }
    setPlatforms(newPlatforms);
  };

  const handleBlogPlatformChange = (newPlatforms: string[]) => {
    if (maxPlatforms !== null && newPlatforms.length > maxPlatforms) {
      setUpgradeTitle('Platform Limit Reached');
      setUpgradeReason(`Free users can generate content for up to ${maxPlatforms} platform${maxPlatforms === 1 ? '' : 's'}.`);
      setShowUpgradeModal(true);
      return;
    }
    setBlogPlatforms(newPlatforms);
  };

  const handleFunctionError = (code?: string, message?: string) => {
    if (code === 'QUOTA_EXCEEDED') {
      setUpgradeTitle('Limit Reached');
      setUpgradeReason(message || 'You reached your plan limits.');
      setShowUpgradeModal(true);
      return true;
    }
    if (code === 'AUTH_REQUIRED') {
      navigate('/login');
      return true;
    }
    if (code === 'VALIDATION_ERROR') {
      toast.error(message || 'Please check your input and try again.');
      return true;
    }
    if (code === 'PROVIDER_ERROR' || code === 'INTERNAL_ERROR') {
      toast.error(message || 'Failed to generate content. Please try again.');
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAtDailyLimit) {
      setUpgradeTitle('Daily Limit Reached');
      setUpgradeReason('You reached your daily generation limit.');
      setShowUpgradeModal(true);
      return;
    }

    if (platformLimitExceeded) {
      setUpgradeTitle('Platform Limit Reached');
      setUpgradeReason(`Free users can generate content for up to ${maxPlatforms} platform${maxPlatforms === 1 ? '' : 's'}.`);
      setShowUpgradeModal(true);
      return;
    }

    if (platforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    if (!topic && !content) {
      toast.error('Please provide a topic or content');
      return;
    }

    if (useBrandVoice && !brandVoiceSelection) {
      toast.error('Please extract and save a brand voice before enabling this toggle.');
      return;
    }

    if (useBrandVoice && !brandVoiceAllowed) {
      setUpgradeTitle('Brand Voice is a Pro Feature');
      setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
      setShowUpgradeModal(true);
      return;
    }

    try {
      setIsLoading(true);
      setResults(null);

      const { data, error } = await edgeFunctions.generatePost({
        type: 'simple',
        topic: topic || 'General post',
        content: content || '',
        tone: tone || 'professional',
        platforms,
        brandVoiceId: useBrandVoice ? defaultBrandVoiceId : null,
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data?.status === 'error') {
        const code = data.error?.code;
        if (handleFunctionError(code, data.error?.message)) return;
        return;
      }

      if (data && (data as any).data?.posts) {
        const posts = (data as any).data.posts as GeneratedContent;
        setResults(posts);
        toast.success(`Generated content for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}!`);

        // Refresh daily usage
        await loadDailyUsage();
      } else if ((data as any)?.posts) {
        setResults((data as any).posts);
        toast.success(`Generated content for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}!`);
        await loadDailyUsage();
      } else {
        toast.error('Failed to generate content. Please try again.');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('An error occurred while generating content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlogToSns = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!limits.blog_to_sns) {
      setUpgradeTitle('Pro Feature');
      setUpgradeReason('Blog-to-SNS is a Pro feature. Upgrade to unlock this capability.');
      setShowUpgradeModal(true);
      return;
    }

    if (isAtDailyLimit) {
      setUpgradeTitle('Daily Limit Reached');
      setUpgradeReason('You reached your daily generation limit.');
      setShowUpgradeModal(true);
      return;
    }

    if (blogPlatformLimitExceeded) {
      setUpgradeTitle('Platform Limit Reached');
      setUpgradeReason(`Free users can generate content for up to ${maxPlatforms} platform${maxPlatforms === 1 ? '' : 's'}.`);
      setShowUpgradeModal(true);
      return;
    }

    if (blogPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    // Get blog content based on source type
    let contentToProcess = '';
    
    if (blogSourceType === 'url') {
      // Validate URL
      const urlValidation = urlSchema.safeParse(blogUrl);
      if (!urlValidation.success) {
        toast.error(urlValidation.error.errors[0].message);
        return;
      }
      
      // For now, ask user to paste content (URL fetching would need a backend function)
      toast.error('URL fetching coming soon! Please use the Text option and paste your blog content.');
      return;
    } else {
      contentToProcess = blogContent;
    }

    // Validate blog content
    const contentValidation = blogContentSchema.safeParse(contentToProcess);
    if (!contentValidation.success) {
      toast.error(contentValidation.error.errors[0].message);
      return;
    }

    // Check blog length limit
    if (maxBlogLength !== null && contentToProcess.length > maxBlogLength) {
      setUpgradeTitle('Blog Length Limit');
      setUpgradeReason(`Free users can repurpose up to ${maxBlogLength.toLocaleString()} characters.`);
      setShowUpgradeModal(true);
      return;
    }

    if (blogUseBrandVoice && !brandVoiceAllowed) {
      setUpgradeTitle('Brand Voice is a Pro Feature');
      setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
      setShowUpgradeModal(true);
      return;
    }

    if (blogUseBrandVoice && !brandVoiceSelection) {
      toast.error('Please extract and save a brand voice before enabling this toggle.');
      return;
    }

    try {
      setIsLoading(true);
      setResults(null);

        const { data, error } = await edgeFunctions.blogToSns({
          type: 'blog',
          blogContent: contentToProcess,
          platforms: blogPlatforms,
          brandVoiceId: blogUseBrandVoice ? defaultBrandVoiceId : null,
        });

      if (error) {
        toast.error(error);
        return;
      }

      if (data?.status === 'error') {
        const code = data.error?.code;
        if (handleFunctionError(code, data.error?.message)) return;
        return;
      }

      if (data && (data as any).data?.posts) {
        const posts = (data as any).data.posts as GeneratedContent;
        setResults(posts);
        toast.success(`Generated content for ${blogPlatforms.length} platform${blogPlatforms.length > 1 ? 's' : ''}!`);

        await loadDailyUsage();
      } else if ((data as any)?.posts) {
        setResults((data as any).posts);
        toast.success(`Generated content for ${blogPlatforms.length} platform${blogPlatforms.length > 1 ? 's' : ''}!`);
        await loadDailyUsage();
      } else {
        toast.error('Failed to generate content. Please try again.');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('An error occurred while generating content');
    } finally {
      setIsLoading(false);
    }
  };

  const VARIATION_STYLES = [
    { id: 'short', label: 'Short', description: 'Concise and to the point' },
    { id: 'long', label: 'Long', description: 'Detailed and comprehensive' },
    { id: 'casual', label: 'Casual', description: 'Friendly and conversational' },
    { id: 'formal', label: 'Formal', description: 'Professional and polished' },
    { id: 'hook-first', label: 'Hook First', description: 'Attention-grabbing opening' },
    { id: 'emotional', label: 'Emotional', description: 'Evokes feelings and connection' },
  ];

  const handleStyleToggle = (styleId: string) => {
    const variationsLimit = limits.variations_per_request ?? null;

    if (selectedStyles.includes(styleId)) {
      setSelectedStyles(selectedStyles.filter(s => s !== styleId));
    } else {
      if (variationsLimit !== null && selectedStyles.length >= variationsLimit) {
        setUpgradeTitle('Variation Limit Reached');
        setUpgradeReason(`Free users can generate up to ${variationsLimit} variation${variationsLimit === 1 ? '' : 's'} per request.`);
        setShowUpgradeModal(true);
        return;
      }
      setSelectedStyles([...selectedStyles, styleId]);
    }
  };

  const handleGenerateVariations = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAtDailyLimit) {
      setUpgradeTitle('Daily Limit Reached');
      setUpgradeReason('You reached your daily generation limit.');
      setShowUpgradeModal(true);
      return;
    }

    if (variationsLimitExceeded) {
      setUpgradeTitle('Variation Limit Reached');
      setUpgradeReason(
        `Free users can generate up to ${limits.variations_per_request} variation${limits.variations_per_request === 1 ? '' : 's'} per request.`
      );
      setShowUpgradeModal(true);
      return;
    }

    if (!baseText.trim()) {
      toast.error('Please enter some text to create variations');
      return;
    }

    if (selectedStyles.length === 0) {
      toast.error('Please select at least one style');
      return;
    }

    if (variationUseBrandVoice && !brandVoiceAllowed) {
      setUpgradeTitle('Brand Voice is a Pro Feature');
      setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
      setShowUpgradeModal(true);
      return;
    }

    if (variationUseBrandVoice && !brandVoiceSelection) {
      toast.error('Please extract and save a brand voice before enabling this toggle.');
      return;
    }

    try {
      setIsLoading(true);
      setVariationResults(null);

      const { data, error } = await edgeFunctions.generateVariations({
        baseText: baseText.trim(),
        styles: selectedStyles,
        brandVoiceId: brandVoiceAllowed && variationUseBrandVoice ? defaultBrandVoiceId : null,
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data?.status === 'error') {
        const code = data.error?.code;
        if (handleFunctionError(code, data.error?.message)) return;
        return;
      }

      const variations = (data as any)?.data?.variations || (data as any)?.variations;

      if (variations) {
        setVariationResults(variations);
        const variationCount = Object.keys(variations).length;
        toast.success(`Generated ${variationCount} variation${variationCount > 1 ? 's' : ''}!`);

        await loadDailyUsage();
      } else {
        toast.error('Failed to generate variations. Please try again.');
      }
    } catch (err) {
      console.error('Variation generation error:', err);
      toast.error('An error occurred while generating variations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVariations = () => {
    setActiveTab('variations');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Content</h1>
          <p className="text-muted-foreground">
            Generate engaging social media posts for multiple platforms
          </p>
        </div>

        {/* Usage Warning */}
        {limits.daily_generations !== null && (
          <Alert className={`mb-6 ${isAtDailyLimit ? 'border-destructive' : ''}`}>
            <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {isAtDailyLimit
                    ? `Daily limit reached (${dailyUsed}/${limits.daily_generations}). Upgrade to Pro for unlimited generations!`
                    : `${dailyUsed}/${limits.daily_generations} generations used today`
                }
              </span>
              {isAtDailyLimit && (
                <Button size="sm" asChild>
                  <Link to="/account#promo">Upgrade to Pro / Enter Promo Code</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Post</TabsTrigger>
            <TabsTrigger value="blog">Blog to SNS</TabsTrigger>
            <TabsTrigger value="variations">Variations</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Generate Social Media Post</CardTitle>
                  <CardDescription>
                    Create AI-powered content optimized for each platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Topic */}
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic or Title</Label>
                      <Input
                        id="topic"
                        placeholder="e.g., New product launch, Company milestone..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <Label htmlFor="content">Content Details (Optional)</Label>
                      <Textarea
                        id="content"
                        placeholder="Add more context, key points, or details you want to include..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={isLoading}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* Tone */}
                    <div className="space-y-2">
                      <Label htmlFor="tone">Tone (Optional)</Label>
                      <Input
                        id="tone"
                        placeholder="e.g., Professional, Casual, Friendly, Exciting..."
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    {/* Platform Selection */}
                    <PlatformSelector
                      selected={platforms}
                      onChange={handlePlatformChange}
                      maxPlatforms={maxPlatforms}
                    />

                    {plan === 'free' && maxPlatforms !== null && (
                      <p className="text-xs text-muted-foreground -mt-1">
                        Free plan: up to {maxPlatforms} platforms
                      </p>
                    )}

                    {/* Brand Voice Toggle */}
                    <div
                      className={`flex items-center justify-between p-4 border rounded-lg ${!brandVoiceAllowed ? 'opacity-60' : ''}`}
                      title={!brandVoiceAllowed ? 'Brand Voice is a Pro feature' : undefined}
                    >
                      <div className="space-y-0.5">
                        <Label htmlFor="brand-voice" className="text-base">
                          Use Brand Voice
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Apply your saved brand voice to all posts
                        </p>
                        {!brandVoiceAllowed && (
                          <Button
                            variant="link"
                            className="px-0 text-primary"
                            type="button"
                            onClick={() => {
                              setUpgradeTitle('Brand Voice is a Pro Feature');
                              setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                              setShowUpgradeModal(true);
                            }}
                          >
                            Activate Pro to use Brand Voice
                          </Button>
                        )}
                      </div>
                      <Switch
                        id="brand-voice"
                        checked={useBrandVoice}
                        onCheckedChange={(checked) => {
                          if (!brandVoiceAllowed) {
                            setUpgradeTitle('Brand Voice is a Pro Feature');
                            setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                            setShowUpgradeModal(true);
                            return;
                          }
                          setUseBrandVoice(checked);
                        }}
                        disabled={isLoading || !brandVoiceAllowed}
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={!canGenerate || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Posts
                        </>
                      )}
                    </Button>

                    {!canGenerate && !isLoading && (
                      <p className="text-sm text-muted-foreground text-center">
                        {isAtDailyLimit 
                          ? 'Daily limit reached'
                          : platforms.length === 0
                          ? 'Select at least one platform'
                          : 'Add a topic or content to continue'}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Results */}
              <div>
                {isLoading && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                      <LoadingSpinner size="lg" />
                      <div>
                        <p className="font-medium">Generating your content...</p>
                        <p className="text-sm text-muted-foreground">This may take a few moments</p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && !results && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 p-8">
                      <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg mb-2">Ready to create?</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Fill in the form and select your platforms to generate optimized social media content
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && results && (
                  <div className="space-y-6">
                    <ResultCards content={results} />
                    
                    {/* Create Variations Button */}
                    <Card>
                      <CardContent className="pt-6">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleCreateVariations}
                        >
                          Create More Variations
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="blog" className="mt-6">
            {/* Feature Gate Alert */}
            {!limits.blog_to_sns && (
              <Alert className="mb-6 border-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Blog-to-SNS is a Pro feature. Upgrade to unlock this capability!</span>
                  <Button size="sm" asChild>
                    <Link to="/account#promo">Upgrade to Pro / Enter Promo Code</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Form */}
              <Card className={!limits.blog_to_sns ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader>
                  <CardTitle>Blog to Social Media</CardTitle>
                  <CardDescription>
                    Convert your blog posts into optimized social media content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBlogToSns} className="space-y-6">
                    {/* Source Type Selector */}
                    <div className="space-y-3">
                      <Label>Source Type</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={blogSourceType === 'text' ? 'default' : 'outline'}
                          className="h-auto py-4 flex flex-col gap-2"
                          onClick={() => setBlogSourceType('text')}
                          disabled={isLoading}
                        >
                          <FileText className="h-5 w-5" />
                          <span className="text-sm font-medium">Paste Text</span>
                        </Button>
                        <Button
                          type="button"
                          variant={blogSourceType === 'url' ? 'default' : 'outline'}
                          className="h-auto py-4 flex flex-col gap-2"
                          onClick={() => setBlogSourceType('url')}
                          disabled={isLoading}
                        >
                          <LinkIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">From URL</span>
                        </Button>
                      </div>
                    </div>

                    {/* URL Input */}
                    {blogSourceType === 'url' && (
                      <div className="space-y-2">
                        <Label htmlFor="blog-url">Blog URL</Label>
                        <Input
                          id="blog-url"
                          type="url"
                          placeholder="https://yourblog.com/post"
                          value={blogUrl}
                          onChange={(e) => setBlogUrl(e.target.value)}
                          disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                          We'll fetch and extract the content from this URL
                        </p>
                      </div>
                    )}

                    {/* Text Content Input */}
                    {blogSourceType === 'text' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="blog-content">Blog Content</Label>
                          {maxBlogLength && (
                            <span className={`text-xs ${
                              blogContent.length > maxBlogLength 
                                ? 'text-destructive font-medium' 
                                : 'text-muted-foreground'
                            }`}>
                              {blogContent.length.toLocaleString()} / {maxBlogLength.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <Textarea
                          id="blog-content"
                          placeholder="Paste your blog post content here..."
                          value={blogContent}
                          onChange={(e) => setBlogContent(e.target.value)}
                          disabled={isLoading}
                          rows={8}
                          className="resize-none font-mono text-sm"
                        />
                        {maxBlogLength && blogContent.length > maxBlogLength && (
                          <p className="text-xs text-destructive">
                            Content exceeds your plan limit. Upgrade to Pro for longer posts.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tone */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-tone">Tone (Optional)</Label>
                      <Input
                        id="blog-tone"
                        placeholder="e.g., Professional, Casual, Engaging..."
                        value={blogTone}
                        onChange={(e) => setBlogTone(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    {/* Platform Selection */}
                    <PlatformSelector
                      selected={blogPlatforms}
                      onChange={handleBlogPlatformChange}
                      maxPlatforms={maxPlatforms}
                    />

                    {plan === 'free' && maxPlatforms !== null && (
                      <p className="text-xs text-muted-foreground -mt-1">
                        Free plan: up to {maxPlatforms} platforms
                      </p>
                    )}

                    {/* Brand Voice Toggle */}
                    <div
                      className={`flex items-center justify-between p-4 border rounded-lg ${!brandVoiceAllowed ? 'opacity-60' : ''}`}
                      title={!brandVoiceAllowed ? 'Brand Voice is a Pro feature' : undefined}
                    >
                      <div className="space-y-0.5">
                        <Label htmlFor="blog-brand-voice" className="text-base">
                          Use Brand Voice
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Apply your saved brand voice to all posts
                        </p>
                        {!brandVoiceAllowed && (
                          <Button
                            variant="link"
                            className="px-0 text-primary"
                            type="button"
                            onClick={() => {
                              setUpgradeTitle('Brand Voice is a Pro Feature');
                              setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                              setShowUpgradeModal(true);
                            }}
                          >
                            Activate Pro to use Brand Voice
                          </Button>
                        )}
                      </div>
                      <Switch
                        id="blog-brand-voice"
                        checked={blogUseBrandVoice}
                        onCheckedChange={(checked) => {
                          if (!brandVoiceAllowed) {
                            setUpgradeTitle('Brand Voice is a Pro Feature');
                            setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                            setShowUpgradeModal(true);
                            return;
                          }
                          setBlogUseBrandVoice(checked);
                        }}
                        disabled={isLoading || !brandVoiceAllowed || !limits.blog_to_sns}
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={
                        !limits.blog_to_sns ||
                        isAtDailyLimit ||
                        isLoading ||
                        blogPlatforms.length === 0 ||
                        (blogSourceType === 'text' && !blogContent) ||
                        (blogSourceType === 'url' && !blogUrl) ||
                        (maxBlogLength !== null && blogContent.length > maxBlogLength) ||
                        blogPlatformLimitExceeded
                      }
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Convert to Social Posts
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Results */}
              <div>
                {isLoading && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                      <LoadingSpinner size="lg" />
                      <div>
                        <p className="font-medium">Converting your blog post...</p>
                        <p className="text-sm text-muted-foreground">This may take a few moments</p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && !results && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 p-8">
                      <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg mb-2">Ready to convert?</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Paste your blog content or enter a URL to generate platform-optimized social media posts
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && results && (
                  <div className="space-y-6">
                    <ResultCards content={results} />
                    
                    <Card>
                      <CardContent className="pt-6">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleCreateVariations}
                        >
                          Create More Variations
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="variations" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Generate Variations</CardTitle>
                  <CardDescription>
                    Create multiple styled versions of your content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGenerateVariations} className="space-y-6">
                    {/* Base Text */}
                    <div className="space-y-2">
                      <Label htmlFor="base-text">Original Content</Label>
                      <Textarea
                        id="base-text"
                        placeholder="Enter the text you want to create variations of..."
                        value={baseText}
                        onChange={(e) => setBaseText(e.target.value)}
                        disabled={isLoading}
                        rows={6}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        We'll generate different versions based on the styles you select
                      </p>
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Select Styles</Label>
                        {limits.variations_per_request && (
                          <span className="text-xs text-muted-foreground">
                            {selectedStyles.length} / {limits.variations_per_request} selected
                          </span>
                        )}
                      </div>
                      <div className="grid gap-3">
                    {VARIATION_STYLES.map((style) => (
                      <div
                        key={style.id}
                        className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleStyleToggle(style.id)}
                          >
                            <Checkbox
                              id={style.id}
                              checked={selectedStyles.includes(style.id)}
                              onCheckedChange={() => handleStyleToggle(style.id)}
                              disabled={isLoading}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor={style.id}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {style.label}
                              </Label>
                            <p className="text-xs text-muted-foreground">
                              {style.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Brand Voice Toggle */}
                  <div
                    className={`flex items-center justify-between p-4 border rounded-lg ${!brandVoiceAllowed ? 'opacity-60' : ''}`}
                    title={!brandVoiceAllowed ? 'Brand Voice is a Pro feature' : undefined}
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor="variation-brand-voice" className="text-base">
                        Use Brand Voice
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Apply your saved brand voice to generated variations
                      </p>
                      {!brandVoiceAllowed && (
                        <Button
                          variant="link"
                          className="px-0 text-primary"
                          type="button"
                          onClick={() => {
                            setUpgradeTitle('Brand Voice is a Pro Feature');
                            setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                            setShowUpgradeModal(true);
                          }}
                        >
                          Activate Pro to use Brand Voice
                        </Button>
                      )}
                    </div>
                    <Switch
                      id="variation-brand-voice"
                      checked={variationUseBrandVoice}
                      onCheckedChange={(checked) => {
                        if (!brandVoiceAllowed) {
                          setUpgradeTitle('Brand Voice is a Pro Feature');
                          setUpgradeReason('Brand Voice is a Pro feature. Activate Pro to enable this toggle.');
                          setShowUpgradeModal(true);
                          return;
                        }
                        setVariationUseBrandVoice(checked);
                      }}
                      disabled={isLoading || !brandVoiceAllowed}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={
                        isAtDailyLimit ||
                        isLoading ||
                        !baseText.trim() ||
                        selectedStyles.length === 0 ||
                        variationsLimitExceeded
                      }
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Variations
                        </>
                      )}
                    </Button>

                    {(!baseText.trim() || selectedStyles.length === 0) && !isLoading && (
                      <p className="text-sm text-muted-foreground text-center">
                        {isAtDailyLimit 
                          ? 'Daily limit reached'
                          : !baseText.trim()
                          ? 'Enter text to continue'
                          : 'Select at least one style'}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Results */}
              <div>
                {isLoading && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                      <LoadingSpinner size="lg" />
                      <div>
                        <p className="font-medium">Generating variations...</p>
                        <p className="text-sm text-muted-foreground">This may take a few moments</p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && !variationResults && (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 p-8">
                      <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg mb-2">Ready to create?</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Enter your content and select styles to generate multiple variations
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {!isLoading && variationResults && (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">Your Variations</CardTitle>
                      <CardDescription>
                        {Object.keys(variationResults).length} version{Object.keys(variationResults).length > 1 ? 's' : ''} generated
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {Object.entries(variationResults).map(([style, text]) => (
                            <VariationCard key={style} style={style} text={text} />
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <UpgradeToProModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          title={upgradeTitle}
          reason={upgradeReason}
        />
      </div>
    </div>
  );
}
