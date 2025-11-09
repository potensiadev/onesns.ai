import { Sparkles, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Hero = () => {
  return (
    <section className="text-center py-16 md:py-24 relative">
      <div className="absolute top-4 right-4">
        <Link to="/connections">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            Manage Connections
          </Button>
        </Link>
      </div>

      <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">AI-Powered Multi-Platform Content</span>
      </div>
      
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
        Create Posts for 5 Platforms
        <br />
        <span className="text-foreground">in One Click</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        Enter your content once and let AI generate optimized posts for Reddit, Threads, Instagram, Twitter, and Pinterest — each tailored to the platform's unique style.
      </p>
    </section>
  );
};
