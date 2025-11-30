import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { edgeFunctions } from '@/api/edgeFunctions';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExtractedVoice {
  tone: string;
  sentenceStyle: string;
  vocabulary: string[];
  strictness: number;
  formatTraits?: string[];
}

export default function Account() {
  const navigate = useNavigate();
  const {
    user,
    plan,
    limits,
    dailyUsed,
    loading,
    loadProfileAndLimits,
    loadDailyUsage,
    brandVoiceSelection,
    setBrandVoice,
  } = useAppStore();
  const [promoCode, setPromoCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminActivating, setIsAdminActivating] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  const [adminPlan, setAdminPlan] = useState<'pro' | 'free'>('pro');
  const [adminOpen, setAdminOpen] = useState(false);
  const [brandVoices, setBrandVoices] = useState<{ id: string; title?: string; voice: ExtractedVoice }[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const isPro = plan === 'pro';
  const defaultBrandVoiceId = brandVoiceSelection?.id || '';
  const adminEnabled = Boolean(import.meta.env.VITE_ADMIN_UPGRADE_SECRET);

  useEffect(() => {
    if (user?.id) {
      setAdminUserId(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadProfileAndLimits();
    loadDailyUsage();
  }, [user, loadDailyUsage, loadProfileAndLimits]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!limits?.brand_voice) {
      setBrandVoices([]);
      return;
    }

    const fetchVoices = async () => {
      try {
        setLoadingVoices(true);
        const { data, error } = await supabase
          .from('brand_voices')
          .select('id, label, extracted_style')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading brand voices', error);
          toast.error('브랜드 보이스를 불러오지 못했어요.');
          setBrandVoices([]);
          return;
        }

        const mapped = (data || []).map((voice) => ({
          id: voice.id,
          title: voice.label,
          voice: voice.extracted_style as unknown as ExtractedVoice,
        }));
        setBrandVoices(mapped);
      } catch (err) {
        console.error('Brand voice fetch error', err);
        toast.error('브랜드 보이스를 불러오지 못했어요.');
      } finally {
        setLoadingVoices(false);
      }
    };

    fetchVoices();
  }, [user, limits?.brand_voice, navigate]);

  const handleActivatePromo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!promoCode.trim()) {
      toast.error('Please enter a promo code');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await edgeFunctions.activatePromo({ code: promoCode.trim() });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success('Pro activated successfully!');
      setPromoCode('');
      await loadProfileAndLimits();
      await loadDailyUsage();
    } catch (err) {
      console.error('Promo activation error', err);
      toast.error('Failed to activate promo code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminUpgrade = async () => {
    const targetUserId = adminUserId.trim() || user?.id;

    if (!targetUserId) {
      toast.error('User ID is required');
      return;
    }

    if (!import.meta.env.VITE_ADMIN_UPGRADE_SECRET) {
      toast.error('Admin secret not configured');
      return;
    }

    try {
      setIsAdminActivating(true);
      const { error } = await edgeFunctions.adminUpgradeUser({
        userId: targetUserId,
        plan: adminPlan,
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success('User plan updated');
      await loadProfileAndLimits();
      await loadDailyUsage();
    } catch (err) {
      console.error('Admin upgrade error', err);
      toast.error('Failed to request activation');
    } finally {
      setIsAdminActivating(false);
    }
  };

  const limitsDisplay = useMemo(() => ({
    daily_generations: limits?.daily_generations ?? 'Unlimited',
    max_platforms_per_request: limits?.max_platforms_per_request ?? 'Unlimited',
    max_blog_length: limits?.max_blog_length ?? 'Unlimited',
    variations_per_request: limits?.variations_per_request ?? 'Unlimited',
    brand_voice: limits?.brand_voice ? 'Enabled' : 'Disabled',
    history_limit: limits?.history_limit ?? 'Unlimited',
    priority_routing: limits?.priority_routing ? 'Enabled' : 'Disabled',
  }), [limits]);

  const handleSelectBrandVoice = (voiceId: string) => {
    const selected = brandVoices.find((v) => v.id === voiceId);
    if (selected) {
      setBrandVoice({ id: selected.id, label: selected.title, voice: selected.voice });
      toast.success('Default brand voice saved');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account and subscription</p>
        </div>

        <Card id="promo">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </div>
            <Badge variant={isPro ? 'default' : 'secondary'} className="text-sm px-3 py-1.5">
              {isPro ? 'Pro Plan' : 'Free Plan'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">Signed in user</p>
              </div>
              <div className="flex items-center gap-3">
                {!isPro && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/account#promo')}>
                    Apply Promo
                  </Button>
                )}
                <div className="text-right text-sm text-muted-foreground">
                  <p>Daily Generations</p>
                  <p className="font-semibold">
                    {dailyUsed} / {limits?.daily_generations ?? 'Unlimited'}
                  </p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Max Platforms per Request</p>
                <p className="font-medium text-lg">
                  {limits?.max_platforms_per_request ?? 'Unlimited'}
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Brand Voice</p>
                <p className="font-medium text-lg flex items-center gap-2">
                  {limits?.brand_voice ? <Check className="h-4 w-4 text-green-500" /> : 'Disabled'}
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Blog to SNS</p>
                <p className="font-medium text-lg flex items-center gap-2">
                  {limits?.blog_to_sns ? <Check className="h-4 w-4 text-green-500" /> : 'Disabled'}
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Max Blog Length</p>
                <p className="font-medium text-lg">
                  {limits?.max_blog_length ?? 'Unlimited'} chars
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Limits</CardTitle>
            <CardDescription>What your current plan includes</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Daily Generations', value: `${dailyUsed} / ${limitsDisplay.daily_generations}` },
              { label: 'Platforms per Request', value: limitsDisplay.max_platforms_per_request },
              { label: 'Max Blog Length', value: limits?.max_blog_length != null ? `${limits.max_blog_length} chars` : 'Unlimited' },
              { label: 'Variations per Request', value: limitsDisplay.variations_per_request },
              { label: 'History Limit', value: limitsDisplay.history_limit },
              { label: 'Brand Voice', value: limitsDisplay.brand_voice },
              { label: 'Priority Routing', value: limitsDisplay.priority_routing },
            ].map((item) => (
              <div key={item.label} className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="font-medium text-lg">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activate Promo Code</CardTitle>
            <CardDescription>Apply a promo code to unlock Pro features</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivatePromo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="promo-code">Enter Promo Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    placeholder="Enter Promo Code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Activating...' : 'Activate'}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Applied instantly. You may need to refresh to see updated limits.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Voice Defaults</CardTitle>
            <CardDescription>Set your preferred voice for future generations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!limits?.brand_voice && (
              <div className="p-6 border rounded-lg bg-muted/30 text-center space-y-3">
                <p className="font-medium">Brand Voice is a Pro feature.</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to Pro to extract and save your brand voice.
                </p>
                <Button onClick={() => navigate('/account#promo')}>Upgrade to Pro / Enter Promo Code</Button>
              </div>
            )}

            {limits?.brand_voice && (
              <>
                {loadingVoices ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoadingSpinner className="h-4 w-4" /> Loading voices...
                  </div>
                ) : brandVoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No saved brand voices yet. Create one in the Brand Voice tab.
                  </div>
                ) : (
                  <RadioGroup
                    value={defaultBrandVoiceId}
                    onValueChange={handleSelectBrandVoice}
                    className="space-y-3"
                  >
                    {brandVoices.map((voice) => (
                      <label
                        key={voice.id}
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:border-primary transition',
                          defaultBrandVoiceId === voice.id && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem value={voice.id} className="mt-1" />
                        <div className="space-y-1">
                          <p className="font-medium">{voice.title || 'Untitled voice'}</p>
                          <p className="text-sm text-muted-foreground">Tone: {voice.voice.tone}</p>
                          <p className="text-sm text-muted-foreground">Sentence Style: {voice.voice.sentenceStyle}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {voice.voice?.vocabulary?.map((vocab) => (
                              <span
                                key={vocab}
                                className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                              >
                                {vocab}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">Strictness: {voice.voice?.strictness}</p>
                          {voice.voice?.formatTraits && voice.voice.formatTraits.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Format: {voice.voice.formatTraits.join(', ')}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {adminEnabled && (
          <Card>
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Admin Tools</CardTitle>
                    <CardDescription>Internal tools for manual upgrades</CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {adminOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-user">Target User ID</Label>
                    <Input
                      id="admin-user"
                      placeholder="Enter user ID"
                      value={adminUserId}
                      onChange={(e) => setAdminUserId(e.target.value)}
                      disabled={isAdminActivating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-plan">Plan</Label>
                    <select
                      id="admin-plan"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={adminPlan}
                      onChange={(e) => setAdminPlan(e.target.value as 'pro' | 'free')}
                      disabled={isAdminActivating}
                    >
                      <option value="pro">Pro</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                  <Button onClick={handleAdminUpgrade} disabled={isAdminActivating} className="w-full sm:w-auto">
                    {isAdminActivating ? 'Applying...' : 'Apply Plan'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires x-admin-secret header set via environment variable.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {!isPro && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upgrade to Pro
              </CardTitle>
              <CardDescription>
                Upgrade to Pro to unlock unlimited history, brand voice, longer repurposing, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => document.getElementById('promo')?.scrollIntoView({ behavior: 'smooth' })}>
                Enter Promo Code
              </Button>
              <Button variant="outline" className="w-full" size="lg" onClick={() => navigate('/account#promo')}>
                Go to Promo Section
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleSignOut}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
