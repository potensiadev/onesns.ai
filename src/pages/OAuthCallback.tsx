import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getFreshAccessToken } from "@/integrations/supabase/auth-utils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const OAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [message, setMessage] = useState("메타 계정 연동을 완료하는 중입니다...");

    useEffect(() => {
        const handleExchange = async () => {
            const code = searchParams.get("code");
            const provider = (searchParams.get("provider") || "facebook") as
                | "facebook"
                | "instagram"
                | "threads";

            if (!code) {
                setMessage("유효한 인증 코드가 없습니다.");
                toast.error("코드가 없습니다. 다시 시도해주세요.");
                return;
            }

            const stored = sessionStorage.getItem(`meta-oauth:${provider}`);
            if (!stored) {
                setMessage("인증 세션을 찾을 수 없습니다. 처음부터 다시 시도해주세요.");
                toast.error("세션이 만료되었습니다.");
                return;
            }

            try {
                const { code_verifier, redirect_uri } = JSON.parse(stored) as {
                    code_verifier: string;
                    state?: string;
                    redirect_uri?: string;
                };

                const accessToken = await getFreshAccessToken();

                const { error } = await supabase.functions.invoke("social-oauth", {
                    body: {
                        action: "exchange",
                        provider,
                        code,
                        code_verifier,
                        redirect_uri,
                    },
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (error) throw error;

                setMessage("계정이 성공적으로 연동되었습니다. 페이지로 이동합니다...");
                toast.success("메타 계정이 연결되었습니다.");
                sessionStorage.removeItem(`meta-oauth:${provider}`);
                setTimeout(() => navigate("/connections"), 1000);
            } catch (err) {
                console.error(err);
                setMessage("토큰 교환 중 오류가 발생했습니다. 다시 시도해주세요.");
                toast.error("토큰 교환에 실패했습니다");
            }
        };

        handleExchange();
    }, [navigate, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-3 text-lg text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{message}</span>
            </div>
        </div>
    );
};

export default OAuthCallback;
