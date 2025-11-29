import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';
import { Plus, X, Sparkles, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { edgeFunctions } from '@/api/edgeFunctions';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface ExtractedVoice {
  tone: string;
  sentenceStyle: string;
  vocabulary: string[];
  strictness: number;
  formatTraits?: string[];
}

interface ExtractionResult {
  brandVoiceId: string;
  voice: ExtractedVoice;
}

export default function BrandVoice() {
  const navigate = useNavigate();
  const { brandVoiceAllowed, brandVoiceSelection, setBrandVoice } = useAppStore();
  const [title, setTitle] = useState('');
  const [samples, setSamples] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(
    brandVoiceSelection
      ? { brandVoiceId: brandVoiceSelection.id, voice: brandVoiceSelection.voice }
      : null
  );
  const [setAsDefault, setSetAsDefault] = useState(!!brandVoiceSelection);

  useEffect(() => {
    if (brandVoiceSelection) {
      setResult({ brandVoiceId: brandVoiceSelection.id, voice: brandVoiceSelection.voice });
      setSetAsDefault(true);
    } else {
      setSetAsDefault(false);
    }
  }, [brandVoiceSelection]);

  const addSample = () => {
    if (samples.length < 3) {
      setSamples([...samples, '']);
    }
  };

  const removeSample = (index: number) => {
    if (samples.length > 1) {
      setSamples(samples.filter((_, i) => i !== index));
    }
  };

  const updateSample = (index: number, value: string) => {
    const newSamples = [...samples];
    newSamples[index] = value;
    setSamples(newSamples);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty samples and validate
    const validSamples = samples.filter(s => s.trim().length > 0);
    
    if (validSamples.length === 0) {
      toast.error('Please provide at least one sample');
      return;
    }

    const invalidSample = validSamples.find(s => s.length < 50);
    if (invalidSample) {
      toast.error('Each sample must be at least 50 characters');
      return;
    }

    const tooLongSample = validSamples.find(s => s.length > 2000);
    if (tooLongSample) {
      toast.error('Each sample must be less than 2000 characters');
      return;
    }

    try {
      setIsLoading(true);
      setResult(null);

      const { data, error } = await edgeFunctions.extractBrandVoice({
        samples: validSamples,
        title: title.trim() || undefined,
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data) {
        const extraction = data as ExtractionResult;
        setResult(extraction);
        if (setAsDefault) {
          setBrandVoice({ id: extraction.brandVoiceId, voice: extraction.voice });
        }
        toast.success('Brand voice extracted successfully!');
      } else {
        toast.error('Failed to extract brand voice. Please try again.');
      }
    } catch (err) {
      console.error('Brand voice extraction error:', err);
      toast.error('An error occurred while extracting brand voice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setSamples(['']);
    setResult(null);
    setSetAsDefault(false);
    setBrandVoice(null);
  };

  if (!brandVoiceAllowed) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center space-y-3">
            <h1 className="text-3xl font-bold">Brand Voice</h1>
            <p className="text-muted-foreground">
              Define and manage your unique brand voice for consistent content
            </p>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12">
              <div className="text-center space-y-6">
                <div className="p-4 bg-muted rounded-full w-fit mx-auto">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Brand Voice is a Pro feature.</h2>
                  <p className="text-muted-foreground">
                    Activate Pro to unlock brand voice extraction and save your voice for future generations.
                  </p>
                </div>
                <Button size="lg" onClick={() => navigate('/account#promo')}>
                  Upgrade to Pro / Enter Promo Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Brand Voice</h1>
          <p className="text-muted-foreground">
            Define and manage your unique brand voice for consistent content
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle>Extract Brand Voice</CardTitle>
              <CardDescription>
                Provide 1-3 samples of your content to extract your unique voice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Voice Name (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Professional LinkedIn, Casual Twitter..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isLoading || !brandVoiceAllowed}
                    maxLength={50}
                  />
                </div>

                {/* Samples */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Content Samples ({samples.length}/3)</Label>
                    {samples.length < 3 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSample}
                        disabled={isLoading || !brandVoiceAllowed}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Sample
                      </Button>
                    )}
                  </div>

                  {samples.map((sample, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`sample-${index}`} className="text-sm">
                          Sample {index + 1}
                        </Label>
                        {samples.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSample(index)}
                            disabled={isLoading || !brandVoiceAllowed}
                            className="h-6 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        id={`sample-${index}`}
                        placeholder="Paste a sample of your content here (50-2000 characters)..."
                        value={sample}
                        onChange={(e) => updateSample(index, e.target.value)}
                        disabled={isLoading || !brandVoiceAllowed}
                        rows={4}
                        className="resize-none text-sm"
                        maxLength={2000}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {sample.length} / 2000
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="default-voice" className="text-base">
                      Use this as my default voice
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Use this voice automatically in future generations
                    </p>
                  </div>
                  <Switch
                    id="default-voice"
                    checked={setAsDefault}
                    onCheckedChange={(checked) => {
                      setSetAsDefault(checked);
                      if (result) {
                        if (checked) {
                          setBrandVoice({ id: result.brandVoiceId, voice: result.voice });
                        } else {
                          setBrandVoice(null);
                        }
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading || samples.every(s => !s.trim())}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Extract Brand Voice
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
                    <p className="font-medium">Analyzing your content...</p>
                    <p className="text-sm text-muted-foreground">This may take a moment</p>
                  </div>
                </div>
              </Card>
            )}

            {!isLoading && !result && (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 p-8">
                  <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-lg mb-2">Ready to extract?</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Provide samples of your content to analyze and extract your unique brand voice
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!isLoading && result && (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Brand Voice Extracted
                      </CardTitle>
                      <CardDescription>
                        Your unique voice has been analyzed and saved
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tone */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tone</Label>
                    <p className="text-sm bg-muted p-3 rounded-md">{result.voice.tone}</p>
                  </div>

                  {/* Sentence Style */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Sentence Style</Label>
                    <p className="text-sm bg-muted p-3 rounded-md">{result.voice.sentenceStyle}</p>
                  </div>

                  {/* Strictness */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Strictness</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${result.voice.strictness * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {Math.round(result.voice.strictness * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      How strictly to follow the extracted voice patterns
                    </p>
                  </div>

                  {/* Vocabulary */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Key Vocabulary</Label>
                    <div className="flex flex-wrap gap-2">
                      {result.voice.vocabulary.map((word, index) => (
                        <Badge key={index} variant="secondary">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Format Traits */}
                  {result.voice.formatTraits && result.voice.formatTraits.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Format Traits</Label>
                      <div className="flex flex-wrap gap-2">
                        {result.voice.formatTraits.map((trait, index) => (
                          <Badge key={index} variant="outline">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Your brand voice has been saved and can be used when generating content.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleReset}
                    >
                      Extract Another Voice
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
