import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { GeneratedContent } from "@/pages/Index";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface ResultCardsProps {
  content: GeneratedContent;
}

const PLATFORM_CONFIG = {
  twitter: {
    name: "Twitter (X)",
    icon: "🐦",
    color: "border-platform-twitter",
    bgColor: "bg-platform-twitter/10",
  },
  instagram: {
    name: "Instagram",
    icon: "📷",
    color: "border-platform-instagram",
    bgColor: "bg-platform-instagram/10",
  },
  reddit: {
    name: "Reddit",
    icon: "🤖",
    color: "border-platform-reddit",
    bgColor: "bg-platform-reddit/10",
  },
  threads: {
    name: "Threads",
    icon: "🧵",
    color: "border-platform-threads",
    bgColor: "bg-platform-threads/10",
  },
  pinterest: {
    name: "Pinterest",
    icon: "📌",
    color: "border-platform-pinterest",
    bgColor: "bg-platform-pinterest/10",
  },
} as const;

type PlatformKey = keyof typeof PLATFORM_CONFIG;

export const ResultCards = ({ content }: ResultCardsProps) => {
  const { t } = useTranslation();
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Only validate platforms that are actually in the generated content
    const generatedPlatforms = Object.keys(content) as PlatformKey[];
    const missingFields = generatedPlatforms.filter((platform) => {
      const value = content?.[platform];
      return typeof value !== "string" || value.trim().length === 0;
    });

    if (missingFields.length > 0) {
      const message = `Generated response is missing content for: ${missingFields.join(", ")}`;
      setValidationError(message);
      toast.error(message);
    } else {
      setValidationError(null);
    }
  }, [content]);

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('results.copied', { platform }));
  };

  if (validationError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-destructive"
      >
        <h2 className="text-xl font-semibold mb-2">{t('results.error')}</h2>
        <p>{validationError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">{t('results.title')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('results.description')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(content).map(([platform, text]) => {
          const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];

          return (
            <Card
              key={platform}
              className={`shadow-md hover:shadow-lg transition-all duration-300 border-2 ${config.color}`}
            >
              <CardHeader className={`${config.bgColor}`}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    {config.name}
                  </span>
                  <Badge variant="outline" className="font-normal">
                    {text.length} {t('results.chars')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="prose prose-sm max-w-none mb-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyToClipboard(text, config.name)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t('results.copy')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
