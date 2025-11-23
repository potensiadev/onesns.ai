import { Sparkles, Settings, LogIn, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UserMenu from "./UserMenu";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export const Hero = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <section className="text-center py-16 md:py-24 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        {user ? (
          <>
            <UserMenu />
          </>
        ) : (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => navigate("/auth")}
            >
              <LogIn className="w-4 h-4" />
              {t('hero.login')}
            </Button>
            <Button 
              size="sm" 
              className="gap-2"
              onClick={() => navigate("/auth")}
            >
              <UserPlus className="w-4 h-4" />
              {t('hero.signup')}
            </Button>
          </>
        )}
      </div>

      <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">{t('hero.badge')}</span>
      </div>
      
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
        {t('hero.title1')}
        <br />
        <span className="text-foreground">{t('hero.title2')}</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        {t('hero.description')}
      </p>
    </section>
  );
};
