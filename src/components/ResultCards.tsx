import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export type GeneratedContent = Record<string, string>;

interface ResultCardsProps {
  content: GeneratedContent;
}

const PLATFORM_CONFIG = {
  facebook: {
    name: "Facebook",
    icon: "📘",
    color: "border-blue-500",
    bgColor: "bg-blue-500/10",
  },
  instagram: {
    name: "Instagram",
    icon: "📷",
    color: "border-pink-500",
    bgColor: "bg-pink-500/10",
  },
  linkedin: {
    name: "LinkedIn",
    icon: "💼",
    color: "border-blue-700",
    bgColor: "bg-blue-700/10",
  },
  twitter: {
    name: "Twitter",
    icon: "🐦",
    color: "border-sky-500",
    bgColor: "bg-sky-500/10",
  },
  threads: {
    name: "Threads",
    icon: "🧵",
    color: "border-slate-700",
    bgColor: "bg-slate-700/10",
  },
  youtube: {
    name: "YouTube",
    icon: "📹",
    color: "border-red-600",
    bgColor: "bg-red-600/10",
  },
} as const;

export const ResultCards = ({ content }: ResultCardsProps) => {
  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${platform} content to clipboard!`);
  };

  const platformEntries = Object.entries(content);

  if (platformEntries.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No content generated
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Your Generated Content</h2>
        <p className="text-muted-foreground">
          Content optimized for {platformEntries.length} platform{platformEntries.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid gap-4">
        {platformEntries.map(([platform, text]) => {
          const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG] || {
            name: platform,
            icon: "📝",
            color: "border-primary",
            bgColor: "bg-primary/10",
          };

          return (
            <Card
              key={platform}
              className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${config.color} border-l-4`}
            >
              <CardHeader className={`${config.bgColor} pb-4`}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <span className="font-bold">{config.name}</span>
                  </span>
                  <Badge variant="outline" className="font-semibold">
                    {text.length} chars
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="prose prose-sm max-w-none min-h-[100px]">
                  <p className="whitespace-pre-wrap text-base leading-relaxed">
                    {text}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyToClipboard(text, config.name)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
