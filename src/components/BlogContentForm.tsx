import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BlogContentFormProps {
  onGenerate: (blogContent: string, keyMessage: string, platforms: string[]) => void;
  isGenerating: boolean;
}

const MAX_CHARS = 10000;

export const BlogContentForm = ({ onGenerate, isGenerating }: BlogContentFormProps) => {
  const { t } = useTranslation();

  const PLATFORMS = [
    { id: "twitter", label: t('platforms.twitter'), color: "platform-twitter" },
    { id: "instagram", label: t('platforms.instagram'), color: "platform-instagram" },
    { id: "reddit", label: t('platforms.reddit'), color: "platform-reddit" },
    { id: "threads", label: t('platforms.threads'), color: "platform-threads" },
    { id: "pinterest", label: t('platforms.pinterest'), color: "platform-pinterest" }
  ];
  const [blogContent, setBlogContent] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);

  const charCount = blogContent.length;
  const isOverLimit = charCount > MAX_CHARS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverLimit) {
      return;
    }
    onGenerate(blogContent, keyMessage, selectedPlatforms);
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  return (
    <Card className="shadow-lg mb-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('blogForm.title')}
        </CardTitle>
        <CardDescription>
          {t('blogForm.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="blogContent">{t('blogForm.blogContent')}</Label>
              <span
                className={`text-sm ${
                  isOverLimit
                    ? "text-red-500 font-semibold"
                    : charCount > MAX_CHARS * 0.9
                    ? "text-orange-500"
                    : "text-muted-foreground"
                }`}
              >
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}{t('blogForm.characters')}
              </span>
            </div>
            <Textarea
              id="blogContent"
              placeholder={t('blogForm.blogPlaceholder')}
              value={blogContent}
              onChange={(e) => setBlogContent(e.target.value)}
              required
              className="min-h-64 resize-y font-mono text-sm leading-relaxed"
            />
            {isOverLimit && (
              <p className="text-sm text-red-500">
                {t('blogForm.overLimit', { max: MAX_CHARS.toLocaleString() })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('blogForm.tip')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyMessage">{t('blogForm.keyMessage')}</Label>
            <Input
              id="keyMessage"
              placeholder={t('blogForm.keyMessagePlaceholder')}
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              {t('blogForm.keyMessageTip')}
            </p>
          </div>

          <div className="space-y-3">
            <Label>{t('blogForm.selectPlatforms')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-center font-medium text-sm ${
                    selectedPlatforms.includes(platform.id)
                      ? `border-${platform.color} bg-${platform.color}/10 shadow-md`
                      : 'border-border hover:border-muted-foreground/30'
                  } cursor-pointer hover:scale-105`}
                >
                  {platform.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isGenerating || isOverLimit || !blogContent.trim()}
            className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('blogForm.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                {t('blogForm.generate')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
