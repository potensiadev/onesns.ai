import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Chrome } from "lucide-react";

const authSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다" }),
  fullName: z.string().trim().optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showResendEmail, setShowResendEmail] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = authSchema.parse({ email, password, fullName });
      setIsLoading(true);

      const redirectUrl = `${window.location.origin}/`;

      console.log("Attempting signup with:", {
        email: validated.email,
        passwordLength: validated.password.length,
        hasFullName: !!validated.fullName,
        redirectUrl
      });

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validated.fullName || "",
          }
        }
      });

      if (error) {
        console.error("Signup error details:", error);
        if (error.message.includes("already registered")) {
          toast.error("이미 가입된 이메일입니다. 로그인해주세요.");
        } else if (error.status === 422) {
          toast.error(`회원가입 실패: ${error.message || '입력 정보를 확인해주세요'}`, {
            duration: 6000,
          });
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("회원가입이 완료되었습니다! 이메일을 확인하여 인증을 완료해주세요.", {
        duration: 8000,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("회원가입 중 오류가 발생했습니다");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      toast.error("이메일 주소를 입력해주세요");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("인증 이메일이 재발송되었습니다. 메일함을 확인해주세요.", {
          duration: 6000,
        });
        setShowResendEmail(false);
      }
    } catch (error) {
      toast.error("이메일 재발송 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = authSchema.parse({ email, password });
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("이메일 또는 비밀번호가 올바르지 않습니다. 회원가입 후 이메일 인증을 완료하셨나요?", {
            duration: 6000,
          });
          setShowResendEmail(true);
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("이메일 인증이 필요합니다. 받은 메일함을 확인해주세요.", {
            duration: 6000,
          });
          setShowResendEmail(true);
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("로그인되었습니다!");
      setShowResendEmail(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("로그인 중 오류가 발생했습니다");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      toast.error("Google 로그인 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>환영합니다</CardTitle>
          <CardDescription>계정에 로그인하거나 새로 만드세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Google로 계속하기
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  또는
                </span>
              </div>
            </div>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">로그인</TabsTrigger>
                <TabsTrigger value="signup">회원가입</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">이메일</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">비밀번호</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "로그인 중..." : "로그인"}
                  </Button>

                  {showResendEmail && (
                    <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                      <p className="text-sm text-muted-foreground">
                        이메일 인증을 완료하지 않으셨나요?
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleResendConfirmation}
                        disabled={isLoading}
                      >
                        인증 이메일 다시 받기
                      </Button>
                    </div>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">이름 (선택)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="홍길동"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">이메일</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">비밀번호</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "가입 중..." : "회원가입"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
