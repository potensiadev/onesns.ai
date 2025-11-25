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
    <section className="text-center py-20 md:py-32 relative">
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <LanguageSwitcher />
        {user ? (
          <>
            <UserMenu />
          </>
        ) : (
          <>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 font-semibold"
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

      <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/5 border border-primary/20 rounded-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-primary">{t('hero.badge')}</span>
      </div>
      
      <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
        <span className="bg-gradient-primary bg-clip-text text-transparent">{t('hero.title1')}</span>
        <br />
        <span className="text-foreground font-extrabold">{t('hero.title2')}</span>
      </h1>
      
      <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed font-light animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        {t('hero.description')}
      </p>
    </section>
  );
};
