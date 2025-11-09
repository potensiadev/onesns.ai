import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { GeneratedContent } from "@/pages/Index";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface ResultCardsProps {
  content: GeneratedContent;
}

const PLATFORM_CONFIG = {
  reddit: {
    name: "Reddit",
    icon: "🔴",
    color: "border-platform-reddit",
    bgColor: "bg-platform-reddit/10",
  },
  threads: {
    name: "Threads",
    icon: "⚫",
    color: "border-platform-threads",
    bgColor: "bg-platform-threads/10",
  },
  instagram: {
    name: "Instagram",
    icon: "📸",
    color: "border-platform-instagram",
    bgColor: "bg-platform-instagram/10",
  },
  twitter: {
    name: "Twitter (X)",
    icon: "🐦",
    color: "border-platform-twitter",
    bgColor: "bg-platform-twitter/10",
  },
  pinterest: {
    name: "Pinterest",
    icon: "📌",
    color: "border-platform-pinterest",
    bgColor: "bg-platform-pinterest/10",
  },
};

export const ResultCards = ({ content }: ResultCardsProps) => {
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("id, platform");

      if (error) throw error;

      const accountsMap: Record<string, string> = {};
      data?.forEach((account) => {
        accountsMap[account.platform] = account.id;
      });
      setConnectedAccounts(accountsMap);
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
    }
  };

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${platform} post copied to clipboard!`);
  };

  const publishPost = async (platform: string, postContent: string) => {
    const accountId = connectedAccounts[platform];
    if (!accountId) {
      toast.error(`${platform}에 연결된 계정이 없습니다. 먼저 토큰을 등록하세요.`);
      return;
    }

    setPublishing(platform);
    try {
      const { data, error } = await supabase.functions.invoke("publish-post", {
        body: { 
          platform, 
          content: postContent,
          accountId 
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`${PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG].name}에 성공적으로 게시되었습니다!`);
      } else {
        throw new Error(data.error || "게시에 실패했습니다");
      }
    } catch (error: any) {
      console.error("Error publishing post:", error);
      toast.error(error.message || `${platform} 게시에 실패했습니다`);
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Generated Posts</h2>
        <p className="text-muted-foreground">
          Copy and paste these optimized posts to each platform
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
                    {text.length} chars
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="prose prose-sm max-w-none mb-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyToClipboard(text, config.name)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    복사
                  </Button>
                  {connectedAccounts[platform] && (
                    <Button
                      size="sm"
                      onClick={() => publishPost(platform, text)}
                      disabled={publishing === platform}
                      className="gap-2"
                    >
                      {publishing === platform ? (
                        <>업로드 중...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          업로드
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
