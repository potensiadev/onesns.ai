import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string | null;
  created_at: string;
}

const PLATFORMS = [
  { id: "reddit", name: "Reddit", icon: "🔴" },
  { id: "threads", name: "Threads", icon: "🧵" },
  { id: "instagram", name: "Instagram", icon: "📷" },
  { id: "twitter", name: "X (Twitter)", icon: "🐦" },
  { id: "pinterest", name: "Pinterest", icon: "📌" },
];

const tokenSchema = z.object({
  platform: z.enum(['reddit', 'threads', 'instagram', 'twitter', 'pinterest']),
  account_name: z.string().max(100).optional(),
  access_token: z.string().min(10, "액세스 토큰은 최소 10자 이상이어야 합니다").max(1000, "액세스 토큰이 너무 깁니다"),
  refresh_token: z.string().min(10, "리프레시 토큰은 최소 10자 이상이어야 합니다").max(1000, "리프레시 토큰이 너무 깁니다").optional().or(z.literal('')),
});

const TokenManagement = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    platform: "",
    account_name: "",
    access_token: "",
    refresh_token: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("id, platform, account_name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("계정을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account?: SocialAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        platform: account.platform,
        account_name: account.account_name || "",
        access_token: "",
        refresh_token: "",
      });
    } else {
      setEditingAccount(null);
      setFormData({
        platform: "",
        account_name: "",
        access_token: "",
        refresh_token: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveToken = async () => {
    try {
      // Validate input using zod schema
      const validationResult = tokenSchema.safeParse(formData);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const payload = {
        user_id: user.id,
        platform: formData.platform,
        account_name: formData.account_name || null,
        access_token: formData.access_token,
        refresh_token: formData.refresh_token || null,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("social_accounts")
          .update(payload)
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast.success("토큰이 업데이트되었습니다");
      } else {
        const { error } = await supabase
          .from("social_accounts")
          .insert(payload);

        if (error) throw error;
        toast.success("토큰이 추가되었습니다");
      }

      setIsDialogOpen(false);
      fetchAccounts();
    } catch (error: any) {
      console.error("Error saving token:", error);
      toast.error(error.message || "토큰 저장에 실패했습니다");
    }
  };

  const handleDelete = async (id: string, platform: string) => {
    try {
      const { error } = await supabase
        .from("social_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAccounts(accounts.filter((acc) => acc.id !== id));
      toast.success(`${platform} 토큰이 삭제되었습니다`);
    } catch (error) {
      console.error("Error deleting token:", error);
      toast.error("토큰 삭제에 실패했습니다");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          홈으로 돌아가기
        </Button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              소셜 미디어 토큰 관리
            </h1>
            <p className="text-muted-foreground">
              각 플랫폼의 액세스 토큰을 등록하여 자동 업로드 기능을 사용하세요
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                토큰 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "토큰 수정" : "새 토큰 추가"}</DialogTitle>
                <DialogDescription>
                  소셜 미디어 플랫폼의 API 토큰을 입력하세요
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="platform">플랫폼</Label>
                  <select
                    id="platform"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    disabled={!!editingAccount}
                  >
                    <option value="">선택하세요</option>
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="account_name">계정 이름 (선택사항)</Label>
                  <Input
                    id="account_name"
                    placeholder="@username"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="access_token">액세스 토큰</Label>
                  <div className="relative">
                    <Input
                      id="access_token"
                      type={showToken ? "text" : "password"}
                      placeholder="토큰을 입력하세요"
                      value={formData.access_token}
                      onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="refresh_token">리프레시 토큰 (선택사항)</Label>
                  <Input
                    id="refresh_token"
                    type={showToken ? "text" : "password"}
                    placeholder="리프레시 토큰을 입력하세요"
                    value={formData.refresh_token}
                    onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSaveToken}>저장</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                등록된 토큰이 없습니다. 위의 "토큰 추가" 버튼을 클릭하여 시작하세요.
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => {
              const platform = PLATFORMS.find((p) => p.id === account.platform);
              return (
                <Card key={account.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">{platform?.icon}</span>
                          {platform?.name}
                        </CardTitle>
                        {account.account_name && (
                          <CardDescription className="mt-1">
                            {account.account_name}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(account)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(account.id, platform?.name || "")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      등록일: {new Date(account.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenManagement;
