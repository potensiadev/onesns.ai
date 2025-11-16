import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Send, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GeneratedContent } from "@/pages/Index";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

type PublishStatus = "idle" | "publishing" | "success" | "error";

interface PlatformStatus {
  status: PublishStatus;
  error?: string;
}

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

const REQUIRED_PLATFORMS = Object.keys(PLATFORM_CONFIG) as PlatformKey[];

export const ResultCards = ({ content }: ResultCardsProps) => {
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, string>>({});
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformStatus>>({});
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectedAccounts();
    // Initialize platform statuses
    const initialStatuses: Record<string, PlatformStatus> = {};
    Object.keys(content).forEach(platform => {
      initialStatuses[platform] = { status: "idle" };
    });
    setPlatformStatuses(initialStatuses);
  }, [content]);

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

  const publishPost = async (platform: string, postContent: string, silent = false) => {
    const accountId = connectedAccounts[platform];
    if (!accountId) {
      const errorMsg = `${platform}에 연결된 계정이 없습니다. 먼저 토큰을 등록하세요.`;
      if (!silent) toast.error(errorMsg);
      setPlatformStatuses(prev => ({
        ...prev,
        [platform]: { status: "error", error: "계정 미연결" }
      }));
      return { success: false, error: errorMsg };
    }

    setPlatformStatuses(prev => ({
      ...prev,
      [platform]: { status: "publishing" }
    }));

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
        setPlatformStatuses(prev => ({
          ...prev,
          [platform]: { status: "success" }
        }));
        if (!silent) {
          toast.success(`${PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG].name}에 성공적으로 게시되었습니다!`);
        }
        return { success: true };
      } else {
        throw new Error(data.error || "게시에 실패했습니다");
      }
    } catch (error: any) {
      console.error("Error publishing post:", error);
      const errorMsg = error.message || `${platform} 게시에 실패했습니다`;
      setPlatformStatuses(prev => ({
        ...prev,
        [platform]: { status: "error", error: errorMsg }
      }));
      if (!silent) toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const publishAllPosts = async () => {
    const platformsToPublish = Object.keys(content).filter(
      platform => connectedAccounts[platform]
    );

    if (platformsToPublish.length === 0) {
      toast.error("연결된 계정이 없습니다. 먼저 토큰 관리 페이지에서 계정을 연결하세요.");
      return;
    }

    setIsPublishingAll(true);

    // Publish all platforms in parallel
    const results = await Promise.allSettled(
      platformsToPublish.map(platform =>
        publishPost(platform, content[platform as keyof typeof content], true)
      )
    );

    // Count successes and failures
    const successCount = results.filter(
      (result) => result.status === "fulfilled" && result.value.success
    ).length;
    const failureCount = results.length - successCount;

    setIsPublishingAll(false);

    // Show summary toast
    if (failureCount === 0) {
      toast.success(`🎉 모든 플랫폼(${successCount}개)에 성공적으로 게시되었습니다!`);
    } else if (successCount === 0) {
      toast.error(`❌ 모든 게시가 실패했습니다. (${failureCount}개)`);
    } else {
      toast.warning(`⚠️ 부분 성공: ${successCount}개 성공, ${failureCount}개 실패`);
    }
  };

  const retryFailedPosts = async () => {
    const failedPlatforms = Object.entries(platformStatuses)
      .filter(([_, status]) => status.status === "error")
      .map(([platform]) => platform);

    if (failedPlatforms.length === 0) {
      toast.info("재시도할 실패한 게시물이 없습니다.");
      return;
    }

    setIsPublishingAll(true);

    const results = await Promise.allSettled(
      failedPlatforms.map(platform =>
        publishPost(platform, content[platform as keyof typeof content], true)
      )
    );

    const successCount = results.filter(
      (result) => result.status === "fulfilled" && result.value.success
    ).length;

    setIsPublishingAll(false);

    if (successCount > 0) {
      toast.success(`${successCount}개의 게시물이 재시도되어 성공했습니다!`);
    } else {
      toast.error("재시도에 실패했습니다.");
    }
  };

  const connectedCount = Object.keys(content).filter(p => connectedAccounts[p]).length;
  const hasFailedPosts = Object.values(platformStatuses).some(s => s.status === "error");

  if (validationError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-destructive"
      >
        <h2 className="text-xl font-semibold mb-2">Unable to display generated posts</h2>
        <p>{validationError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">생성된 게시물</h2>
        <p className="text-muted-foreground mb-4">
          각 플랫폼에 최적화된 게시물이 생성되었습니다
        </p>

        {connectedCount > 0 && (
          <div className="flex gap-3 justify-center">
            <Button
              onClick={publishAllPosts}
              disabled={isPublishingAll}
              size="lg"
              className="gap-2 bg-gradient-primary"
            >
              {isPublishingAll ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  모든 플랫폼에 게시 중...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  모두 게시 ({connectedCount}개 플랫폼)
                </>
              )}
            </Button>

            {hasFailedPosts && !isPublishingAll && (
              <Button
                onClick={retryFailedPosts}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <RefreshCw className="h-5 w-5" />
                실패한 게시물 재시도
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(content).map(([platform, text]) => {
          const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
          const platformStatus = platformStatuses[platform] || { status: "idle" };
          const isPublishing = platformStatus.status === "publishing";
          const isSuccess = platformStatus.status === "success";
          const isError = platformStatus.status === "error";

          return (
            <Card
              key={platform}
              className={`shadow-md hover:shadow-lg transition-all duration-300 border-2 ${
                isSuccess
                  ? "border-green-500"
                  : isError
                  ? "border-red-500"
                  : config.color
              }`}
            >
              <CardHeader className={`${config.bgColor}`}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    {config.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {text.length} chars
                    </Badge>
                    {isPublishing && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {isSuccess && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {isError && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isError && platformStatus.error && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠️ {platformStatus.error}
                  </div>
                )}
                {isSuccess && (
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                    ✅ 성공적으로 게시되었습니다
                  </div>
                )}
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
                      disabled={isPublishing || isSuccess}
                      className="gap-2"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          업로드 중
                        </>
                      ) : isSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          완료
                        </>
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
