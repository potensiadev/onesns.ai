import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlatformSelector } from '@/components/PlatformSelector';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAppStore } from '@/store/useAppStore';
import { edgeFunctions } from '@/api/edgeFunctions';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GeneratedContent, ResultCards } from '@/components/ResultCards';
import { Link } from 'react-router-dom';

export default function Create() {
  const { brandVoiceAllowed, maxPlatforms, dailyUsed, limits, loadDailyUsage } = useAppStore();
  
  const [activeTab, setActiveTab] = useState('create');
  
  // Form state
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [useBrandVoice, setUseBrandVoice] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [results, setResults] = useState<GeneratedContent | null>(null);

  const isAtDailyLimit = limits.daily_generations !== null && dailyUsed >= limits.daily_generations;
  const canGenerate = !isAtDailyLimit && platforms.length > 0 && (topic || content);

  const handlePlatformChange = (newPlatforms: string[]) => {
    if (maxPlatforms !== null && newPlatforms.length > maxPlatforms) {
      setShowUpgradeModal(true);
      return;
    }
    setPlatforms(newPlatforms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAtDailyLimit) {
      toast.error('Daily generation limit reached. Upgrade to Pro for unlimited generations!');
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

    try {
      setIsLoading(true);
      setResults(null);

      const { data, error } = await edgeFunctions.generatePost({
        type: 'simple',
        topic: topic || 'General post',
        content: content || '',
        tone: tone || 'professional',
        platforms,
        brandVoiceId: useBrandVoice ? null : null, // Will be null for now until brand voice is implemented
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data && data.posts) {
        setResults(data.posts);
        toast.success(`Generated content for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}!`);
        
        // Refresh daily usage
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

  const handleCreateVariations = () => {
    setActiveTab('variations');
    toast.info('Variations feature coming soon!');
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
                  <Link to="/account">Upgrade to Pro</Link>
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

                    {/* Brand Voice Toggle */}
                    {brandVoiceAllowed && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="brand-voice" className="text-base">
                            Use Brand Voice
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Apply your saved brand voice to all posts
                          </p>
                        </div>
                        <Switch
                          id="brand-voice"
                          checked={useBrandVoice}
                          onCheckedChange={setUseBrandVoice}
                          disabled={isLoading}
                        />
                      </div>
                    )}

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
            <Card>
              <CardHeader>
                <CardTitle>Blog to Social Media</CardTitle>
                <CardDescription>
                  Convert your blog posts into social media content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Feature coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Variations</CardTitle>
                <CardDescription>
                  Create multiple versions of your content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Feature coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upgrade Modal */}
        <AlertDialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upgrade to Pro
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-4">
                <p>
                  Your current plan allows {maxPlatforms} platform{maxPlatforms === 1 ? '' : 's'} per generation.
                </p>
                <p>
                  Upgrade to Pro to generate content for unlimited platforms, unlock brand voice, and get unlimited daily generations!
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Link to="/account">
                  View Plans
                </Link>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
