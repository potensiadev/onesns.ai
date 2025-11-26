import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ContentFormProps {
  onGenerate: (topic: string, content: string, tone: string, platforms: string[]) => Promise<void>;
  isGenerating: boolean;
}

export const ContentForm = ({ onGenerate, isGenerating }: ContentFormProps) => {
  const { t } = useTranslation();

  const PLATFORMS = [
    { id: "twitter", label: t("platforms.twitter"), color: "platform-twitter" },
    { id: "instagram", label: t("platforms.instagram"), color: "platform-instagram" },
    { id: "reddit", label: t("platforms.reddit"), color: "platform-reddit" },
    { id: "threads", label: t("platforms.threads"), color: "platform-threads" },
    { id: "pinterest", label: t("platforms.pinterest"), color: "platform-pinterest" },
  ];

  const TONES = [
    { value: "professional", label: t("contentForm.tones.professional") },
    { value: "casual", label: t("contentForm.tones.casual") },
    { value: "humorous", label: t("contentForm.tones.humorous") },
    { value: "inspirational", label: t("contentForm.tones.inspirational") },
    { value: "educational", label: t("contentForm.tones.educational") },
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
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 mb-12 border-0 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          {t("Idea to SNS Contents")}
        </CardTitle>
        <CardDescription className="text-base mt-2">{t("Write any Idea for SNS Contents")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleGenerate} className="space-y-6" aria-busy={isFormDisabled}>
          {formError && (
            <div
              role="alert"
              className="rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 text-destructive text-sm font-semibold"
            >
              {formError}
            </div>
          )}
          <div className="space-y-3">
            <Label htmlFor="topic" className="text-base font-semibold">
              {t("contentForm.topic")}
            </Label>
            <Input
              id="topic"
              placeholder={t("contentForm.topicPlaceholder")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="h-14 border-2 focus:border-primary rounded-xl text-base"
              disabled={isFormDisabled}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="content" className="text-base font-semibold">
              {t("contentForm.mainContent")}
              <span className="text-muted-foreground text-sm ml-2 font-normal">({content.length}/10000)</span>
            </Label>
            <Textarea
              id="content"
              placeholder={t("contentForm.contentPlaceholder")}
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 10000) {
                  setContent(e.target.value);
                }
              }}
              required
              className="min-h-40 resize-y text-base leading-relaxed border-2 focus:border-primary rounded-xl"
              disabled={isFormDisabled}
              maxLength={10000}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="tone" className="text-base font-semibold">
              {t("contentForm.tone")}
            </Label>
            <Select value={tone} onValueChange={setTone} disabled={isFormDisabled}>
              <SelectTrigger id="tone" className="h-14 border-2 focus:border-primary rounded-xl text-base">
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

          <div className="space-y-4">
            <Label className="text-base font-semibold">{t("contentForm.selectPlatforms")}</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={isFormDisabled}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-center font-semibold text-sm ${
                    selectedPlatforms.includes(platform.id)
                      ? `border-primary bg-primary/5 shadow-md scale-105`
                      : "border-border hover:border-foreground/20 hover:bg-muted"
                  } ${isFormDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
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
            className="w-full h-16 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isFormDisabled ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                {t("contentForm.generating")}
              </>
            ) : (
              <>
                <Sparkles className="mr-3 h-6 w-6" />
                {t("contentForm.generate")}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
