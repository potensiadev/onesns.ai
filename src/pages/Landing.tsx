import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Target, Clock, TrendingUp, Shield, CheckCircle2, ArrowRight, Star } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    {
      icon: Zap,
      title: t("landing.features.multiPlatform.title"),
      description: t("landing.features.multiPlatform.description"),
    },
    {
      icon: Target,
      title: t("landing.features.optimized.title"),
      description: t("landing.features.optimized.description"),
    },
    {
      icon: Clock,
      title: t("landing.features.timeSaving.title"),
      description: t("landing.features.timeSaving.description"),
    },
  ];

  const benefits = [
    t("landing.benefits.noRewriting"),
    t("landing.benefits.platformOptimized"),
    t("landing.benefits.aiPowered"),
    t("landing.benefits.instantGeneration"),
    t("landing.benefits.professionalQuality"),
    t("landing.benefits.multilingual"),
  ];

  const stats = [
    { number: "5", label: t("landing.stats.platforms") },
    { number: "90%", label: t("landing.stats.timeSaved") },
    { number: "10K+", label: t("landing.stats.users") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">OneSNS.ai</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" onClick={() => navigate("/auth")} className="font-semibold">
              {t("landing.nav.login")}
            </Button>
            <Button onClick={() => navigate("/auth")} className="font-semibold">
              {t("landing.nav.getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-8 leading-tight">
            {t("landing.hero.title.part1")}
            <br />
            {t("landing.hero.title.part2")}
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">{t("landing.hero.title.part3")}</span>
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            {t("landing.hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              size="lg"
              className="h-16 px-8 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl"
              onClick={() => navigate("/auth")}
            >
              {t("landing.hero.cta")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 px-8 text-lg font-semibold rounded-xl"
              onClick={() => navigate("/create")}
            >
              {t("landing.hero.tryDemo")}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-sm md:text-base text-muted-foreground font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">{t("landing.features.title")}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t("landing.features.subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="p-8 border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="p-4 bg-primary/10 rounded-2xl w-fit mb-6">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">{t("landing.benefits.title")}</h2>
              <p className="text-xl text-muted-foreground mb-8">{t("landing.benefits.subtitle")}</p>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="p-1 bg-primary/10 rounded-full mt-1">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-lg">{benefit}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="mt-10 h-14 px-8 text-lg font-bold rounded-xl"
                onClick={() => navigate("/auth")}
              >
                {t("landing.benefits.cta")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full"></div>
              <Card className="relative p-8 border-0 shadow-2xl bg-gradient-card">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("landing.showcase.engagement")}</div>
                      <div className="text-2xl font-bold">+250%</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent/10 rounded-lg">
                      <Clock className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("landing.showcase.timeSaved")}</div>
                      <div className="text-2xl font-bold">5 {t("landing.showcase.hours")}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/10 rounded-lg">
                      <Shield className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("landing.showcase.quality")}</div>
                      <div className="text-2xl font-bold">{t("landing.showcase.professional")}</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{t("landing.cta.title")}</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">{t("landing.cta.subtitle")}</p>
          <Button
            size="lg"
            variant="secondary"
            className="h-16 px-10 text-lg font-bold rounded-xl shadow-xl hover:shadow-2xl"
            onClick={() => navigate("/auth")}
          >
            {t("landing.cta.button")}
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">OneSNS.ai</span>
            </div>

            <div className="text-sm text-muted-foreground">© 2024 OneSNS.ai. {t("landing.footer.rights")}</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
