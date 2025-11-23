/* 
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFreshAccessToken, isAuthError } from "@/integrations/supabase/auth-utils";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";

const META_PROVIDERS = [
  {
    id: "facebook" as const,
    name: "Facebook",
    description: "페이지와 Instagram/Threads 연동을 위한 Facebook 앱",
  },
  {
    id: "instagram" as const,
    name: "Instagram",
    description: "콘텐츠 퍼블리싱 및 통계 조회용",
  },
  {
    id: "threads" as const,
    name: "Threads",
    description: "Threads 포스팅 및 계정 연결",
  },
];

const STATUS_LABELS: Record<string, string> = {
  connected: "연결됨",
  reconnect_required: "재연동 필요",
};

type SocialToken = Tables<"users_social_tokens">;

const formatDateTime = (isoDate: string | null) => {
  if (!isoDate) return "-";
  return new Date(isoDate).toLocaleString("ko-KR");
};

const TokenManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchTokens = async (): Promise<SocialToken[]> => {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("인증 정보가 없습니다");

    const { data, error: tokensError } = await supabase
      .from("users_social_tokens")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (tokensError) throw tokensError;
    return data ?? [];
  };

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["users_social_tokens"],
    queryFn: fetchTokens,
    retry: (failureCount, error) => {
      if (isAuthError(error)) return false;
      return failureCount < 2;
    },
  });

  const startOauth = useMutation({
    mutationFn: async (provider: SocialToken["provider"]) => {
      const accessToken = await getFreshAccessToken();
      const redirectUri = `${window.location.origin}/oauth/meta-callback`;

      const { data, error } = await supabase.functions.invoke("social-oauth", {
        body: { action: "start", provider, redirect_uri: redirectUri },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw error;
      if (!data?.authorization_url || !data?.code_verifier) {
        throw new Error("인증 URL 생성에 실패했습니다");
      }

      sessionStorage.setItem(
        `meta-oauth:${provider}`,
        JSON.stringify({
          code_verifier: data.code_verifier,
          state: data.state,
          redirect_uri: redirectUri,
        }),
      );

      return data.authorization_url as string;
    },
    onSuccess: (authorizationUrl) => {
      window.location.href = authorizationUrl;
    },
    onError: (error) => {
      console.error(error);
      toast.error("OAuth 시작에 실패했습니다. 관리자에게 문의하세요.");
    },
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["users_social_tokens"] });
  }, [queryClient]);

  const renderStatusBadge = (token?: SocialToken) => {
    const status = token?.status || "reconnect_required";
    const label = STATUS_LABELS[status] || status;

    const variant = status === "connected" ? "default" : "destructive";

    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ShieldCheck className="h-4 w-4" />
            토큰은 AES-256-GCM으로 암호화되어 저장되며, 만료 7일 전에 자동 갱신됩니다.
          </div>
          <h1 className="text-3xl font-bold">메타 계정 연동</h1>
          <p className="text-muted-foreground mt-2">
            Facebook / Instagram / Threads 계정을 안전하게 연결하고 상태를 확인하세요. 토큰 값 대신 상태와 만료 정보를 제공합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/connections")}>
          뒤로 가기
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {META_PROVIDERS.map((provider) => {
          const token = tokens.find((t) => t.provider === provider.id);
          const nextExpiry = token?.long_lived_expires_at || token?.expires_at;

          return (
            <Card key={provider.id} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{provider.name}</span>
                  {renderStatusBadge(token)}
                </CardTitle>
                <CardDescription>{provider.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>만료 예정일</span>
                    <span className="font-medium text-foreground">{formatDateTime(nextExpiry)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>마지막 동기화</span>
                    <span className="font-medium text-foreground">{formatDateTime(token?.last_synced_at || null)}</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => startOauth.mutate(provider.id)}
                  disabled={startOauth.isPending}
                >
                  {startOauth.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      리다이렉트 중...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      계정 연결/재연동
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>토큰 상태 요약</CardTitle>
          <CardDescription>토큰 문자열 대신 상태와 만료 정보를 제공합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>플랫폼</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>만료 예정일</TableHead>
                  <TableHead>마지막 동기화</TableHead>
                  <TableHead>권한 범위</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {META_PROVIDERS.map((provider) => {
                  const token = tokens.find((t) => t.provider === provider.id);
                  const scopes = token?.scopes?.join(", ") || "-";
                  return (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>{renderStatusBadge(token)}</TableCell>
                      <TableCell>{formatDateTime(token?.long_lived_expires_at || token?.expires_at || null)}</TableCell>
                      <TableCell>{formatDateTime(token?.last_synced_at || null)}</TableCell>
                      <TableCell>{scopes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center text-sm text-muted-foreground">불러오는 중...</div>
      )}
    </div>
  );
};

export default TokenManagement;
*/

// This page has been commented out - token management features are hidden
const TokenManagement = () => {
  return null;
};

export default TokenManagement;
