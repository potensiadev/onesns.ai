import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Link2 } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface ConnectedAccount {
  id: string;
  platform: string;
  account_name: string | null;
  created_at: string;
}

interface SocialAccountCardProps {
  platform: Platform;
  connectedAccount?: ConnectedAccount;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const SocialAccountCard = ({
  platform,
  connectedAccount,
  isConnecting,
  onConnect,
  onDisconnect,
}: SocialAccountCardProps) => {
  const isConnected = !!connectedAccount;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`text-4xl bg-${platform.color}/10 p-3 rounded-lg`}>
            {platform.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {platform.name}
              {isConnected && (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </h3>
            {isConnected && connectedAccount?.account_name && (
              <p className="text-sm text-muted-foreground">
                @{connectedAccount.account_name}
              </p>
            )}
            {isConnected && (
              <p className="text-xs text-muted-foreground mt-1">
                Connected on {new Date(connectedAccount!.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div>
          {isConnected ? (
            <Button
              variant="outline"
              onClick={onDisconnect}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
