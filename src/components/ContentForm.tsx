import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ContentFormProps {
  onGenerate: (topic: string, content: string, tone: string, platforms: string[]) => Promise<void>;
  isGenerating: boolean;
}

export const ContentForm = ({ onGenerate, isGenerating }: ContentFormProps) => {
  const { t } = useTranslation();

  const PLATFORMS = [
    { id: "twitter", label: t('platforms.twitter'), color: "platform-twitter" },
    { id: "instagram", label: t('platforms.instagram'), color: "platform-instagram" },
    { id: "reddit", label: t('platforms.reddit'), color: "platform-reddit" },
    { id: "threads", label: t('platforms.threads'), color: "platform-threads" },
    { id: "pinterest", label: t('platforms.pinterest'), color: "platform-pinterest" },
  ];

  const TONES = [
    { value: "professional", label: t('contentForm.tones.professional') },
    { value: "casual", label: t('contentForm.tones.casual') },
    { value: "humorous", label: t('contentForm.tones.humorous') },
    { value: "inspirational", label: t('contentForm.tones.inspirational') },
    { value: "educational", label: t('contentForm.tones.educational') },
  ];
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("professional");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormDisabled = isGenerating || isSubmitting;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await onGenerate(topic, content, tone, selectedPlatforms);
    } catch (error) {
      console.error("Form submission failed", error);
      setFormError(error instanceof Error ? error.message : "Failed to generate content. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((id) => id !== platformId) : [...prev, platformId],
    );
  };

  return (
    <Card className="shadow-lg mb-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
      <CardContent className="pt-6">
        <form onSubmit={handleGenerate} className="space-y-6" aria-busy={isFormDisabled}>
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive text-sm"
            >
              {formError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="topic">{t('contentForm.topic')}</Label>
            <Input
              id="topic"
              placeholder={t('contentForm.topicPlaceholder')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="h-12"
              disabled={isFormDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">
              {t('contentForm.mainContent')}
              <span className="text-muted-foreground text-xs ml-2">({content.length}/10000)</span>
            </Label>
            <Textarea
              id="content"
              placeholder={t('contentForm.contentPlaceholder')}
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 10000) {
                  setContent(e.target.value);
                }
              }}
              required
              className="min-h-32 resize-none"
              disabled={isFormDisabled}
              maxLength={10000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">{t('contentForm.tone')}</Label>
            <Select value={tone} onValueChange={setTone} disabled={isFormDisabled}>
              <SelectTrigger id="tone" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((toneItem) => (
                  <SelectItem key={toneItem.value} value={toneItem.value}>
                    {toneItem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>{t('contentForm.selectPlatforms')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={isFormDisabled}
                  className={`p-3 rounded-lg border-2 transition-all text-center font-medium text-sm ${
                    selectedPlatforms.includes(platform.id)
                      ? `border-${platform.color} bg-${platform.color}/10 shadow-md`
                      : "border-border hover:border-muted-foreground/30"
                  } ${isFormDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}`}
                >
                  {platform.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isFormDisabled}
            className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow"
          >
            {isFormDisabled ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('contentForm.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                {t('contentForm.generate')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
