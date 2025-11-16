import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Sparkles } from "lucide-react";

interface BlogContentFormProps {
  onGenerate: (blogContent: string, keyMessage: string, platforms: string[]) => void;
  isGenerating: boolean;
}

const PLATFORMS = [
  { id: "twitter", label: "Twitter (X)", color: "platform-twitter" },
  { id: "instagram", label: "Instagram", color: "platform-instagram" },
  { id: "reddit", label: "Reddit", color: "platform-reddit" },
  { id: "threads", label: "Threads", color: "platform-threads" },
  { id: "pinterest", label: "Pinterest", color: "platform-pinterest" }
];

const MAX_CHARS = 3000; // Backend limit for content

export const BlogContentForm = ({ onGenerate, isGenerating }: BlogContentFormProps) => {
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
          블로그 콘텐츠를 소셜 미디어 게시물로 변환
        </CardTitle>
        <CardDescription>
          작성한 블로그 글을 붙여넣으면 AI가 각 소셜 미디어에 최적화된 게시물을 자동으로 생성합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="blogContent">블로그 전문</Label>
              <span
                className={`text-sm ${
                  isOverLimit
                    ? "text-red-500 font-semibold"
                    : charCount > MAX_CHARS * 0.9
                    ? "text-orange-500"
                    : "text-muted-foreground"
                }`}
              >
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}자
              </span>
            </div>
            <Textarea
              id="blogContent"
              placeholder="블로그 전체 내용을 여기에 붙여넣으세요. AI가 핵심 내용을 분석하여 각 플랫폼에 맞는 게시물을 생성합니다...&#10;&#10;예시:&#10;오늘은 React 19의 새로운 기능에 대해 알아보겠습니다.&#10;&#10;React 19에서는 Server Components가 안정화되었고...&#10;(블로그 전체 내용)"
              value={blogContent}
              onChange={(e) => setBlogContent(e.target.value)}
              required
              className="min-h-64 resize-y font-mono text-sm leading-relaxed"
            />
            {isOverLimit && (
              <p className="text-sm text-red-500">
                ⚠️ 글자 수가 너무 많습니다. AI 처리를 위해 {MAX_CHARS.toLocaleString()}자 이하로 줄여주세요.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              💡 팁: 긴 블로그는 AI가 자동으로 핵심 내용을 요약하여 각 플랫폼에 맞게 변환합니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyMessage">핵심 메시지 강조 (선택사항)</Label>
            <Input
              id="keyMessage"
              placeholder="예: 성능이 30% 향상되었고, 개발 경험이 크게 개선됨"
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              특별히 강조하고 싶은 핵심 포인트가 있다면 입력해주세요. AI가 이를 우선적으로 반영합니다.
            </p>
          </div>

          <div className="space-y-3">
            <Label>게시할 플랫폼 선택</Label>
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
                AI가 블로그를 분석하고 게시물 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                블로그 분석 및 게시물 생성
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
