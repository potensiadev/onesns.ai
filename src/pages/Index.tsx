import { useState } from "react";
import { Hero } from "@/components/Hero";
import { ContentForm } from "@/components/ContentForm";
import { BlogContentForm } from "@/components/BlogContentForm";
import { ResultCards } from "@/components/ResultCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Sparkles } from "lucide-react";

export interface GeneratedContent {
  reddit: string;
  threads: string;
  instagram: string;
  twitter: string;
  pinterest: string;
}

const Index = () => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (
    topic: string,
    content: string,
    tone: string,
    platforms: string[]
  ) => {
    if (platforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-posts", {
        body: { type: "simple", topic, content, tone, platforms },
      });

      if (error) throw error;

      setGeneratedContent(data.posts);
      toast.success("Content generated successfully!");
    } catch (error: any) {
      console.error("Error generating content:", error);
      if (error.status === 429) {
        toast.error("Rate limit exceeded. Please try again in a moment.");
      } else if (error.status === 402) {
        toast.error("AI credits depleted. Please add credits to continue.");
      } else {
        toast.error("Failed to generate content. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromBlog = async (
    blogContent: string,
    keyMessage: string,
    platforms: string[]
  ) => {
    if (platforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-posts", {
        body: { type: "blog", blogContent, keyMessage, platforms },
      });

      if (error) throw error;

      setGeneratedContent(data.posts);
      toast.success("Blog content analyzed and posts generated successfully!");
    } catch (error: any) {
      console.error("Error generating content:", error);
      if (error.status === 429) {
        toast.error("Rate limit exceeded. Please try again in a moment.");
      } else if (error.status === 402) {
        toast.error("AI credits depleted. Please add credits to continue.");
      } else {
        toast.error("Failed to generate content. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Hero />

        <Tabs defaultValue="simple" className="w-full mb-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="simple" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              간단 입력
            </TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              블로그 변환
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simple">
            <ContentForm onGenerate={handleGenerate} isGenerating={isGenerating} />
          </TabsContent>

          <TabsContent value="blog">
            <BlogContentForm onGenerate={handleGenerateFromBlog} isGenerating={isGenerating} />
          </TabsContent>
        </Tabs>

        {generatedContent && <ResultCards content={generatedContent} />}
      </div>
    </div>
  );
};

export default Index;
