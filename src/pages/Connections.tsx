import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { SocialAccountCard } from "@/components/SocialAccountCard";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string | null;
  created_at: string;
}

const PLATFORMS = [
  { id: "reddit", name: "Reddit", color: "reddit", icon: "🔴" },
  { id: "threads", name: "Threads", color: "threads", icon: "🧵" },
  { id: "instagram", name: "Instagram", color: "instagram", icon: "📷" },
  { id: "twitter", name: "X (Twitter)", color: "twitter", icon: "🐦" },
  { id: "pinterest", name: "Pinterest", color: "pinterest", icon: "📌" },
];

const Connections = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("id, platform, account_name, created_at");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to load connected accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    
    // TODO: Implement OAuth flow for each platform
    // For now, show a placeholder message
    toast.info(`OAuth integration for ${platformId} will be implemented soon`);
    
    setConnectingPlatform(null);
  };

  const handleDisconnect = async (accountId: string, platform: string) => {
    try {
      const { error } = await supabase
        .from("social_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      setAccounts(accounts.filter((acc) => acc.id !== accountId));
      toast.success(`${platform} account disconnected`);
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
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
          Back to Home
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Social Media Connections
          </h1>
          <p className="text-muted-foreground">
            Connect your social media accounts to publish posts directly
          </p>
        </div>

        <div className="grid gap-4">
          {PLATFORMS.map((platform) => {
            const connectedAccount = accounts.find(
              (acc) => acc.platform === platform.id
            );

            return (
              <SocialAccountCard
                key={platform.id}
                platform={platform}
                connectedAccount={connectedAccount}
                isConnecting={connectingPlatform === platform.id}
                onConnect={() => handleConnect(platform.id)}
                onDisconnect={() =>
                  connectedAccount && handleDisconnect(connectedAccount.id, platform.name)
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Connections;
