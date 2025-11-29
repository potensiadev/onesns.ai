import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAppStore } from '@/store/useAppStore';
import { edgeFunctions } from '@/api/edgeFunctions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar, Filter, X, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Generation {
  id: string;
  source: string;
  content: string;
  outputs: any;
  platforms: string[];
  topic?: string;
  tone?: string;
  variant_type: string;
  created_at: string;
}

interface HistoryResponse {
  items: Generation[];
  total: number;
  history_limit: number | null;
}

const TYPE_OPTIONS = [
  { id: 'simple', label: 'Multi-Platform' },
  { id: 'blog', label: 'Blog to SNS' },
  { id: 'variation', label: 'Variations' },
];

export default function History() {
  const [isLoading, setIsLoading] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [historyLimit, setHistoryLimit] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [historyLimitValue, setHistoryLimitValue] = useState<number | null>(limits.history_limit ?? null);
  const [noMoreResults, setNoMoreResults] = useState(false);

  const limit = 20;
  const historyLimit = historyLimitValue ?? null;
  const maxPages = historyLimit ? Math.ceil(historyLimit / limit) : null;
  const loadedItems = Math.min((page + 1) * limit, total);
  const reachedHistoryLimit = historyLimit !== null && loadedItems >= historyLimit;
  const canLoadMore =
    !noMoreResults &&
    !reachedHistoryLimit &&
    (maxPages === null || page < maxPages - 1) &&
    loadedItems < total;

  useEffect(() => {
    loadGenerations();
  }, [page, selectedTypes, dateFrom, dateTo]);

  const loadGenerations = async () => {
    try {
      setIsLoading(true);
      setNoMoreResults(false);

      const { data, error } = await edgeFunctions.getGenerations({
        limit,
        offset: page * limit,
        types: selectedTypes.length > 0 ? selectedTypes : null,
        from: dateFrom ? new Date(dateFrom).toISOString() : null,
        to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data) {
        const response = data as HistoryResponse;
        setHistoryLimitValue(response.history_limit ?? null);
        setGenerations(response.items);
        setTotal(response.total);
        if (response.items.length === 0) {
          setNoMoreResults(true);
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      toast.error('Failed to load generation history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeToggle = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes(selectedTypes.filter(t => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
    setPage(0);
    setNoMoreResults(false);
  };

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setDateFrom('');
    setDateTo('');
    setPage(0);
    setNoMoreResults(false);
  };

  const getTypeLabel = (source: string) => {
    const option = TYPE_OPTIONS.find(opt => opt.id === source);
    return option?.label || source;
  };

  const getInputPreview = (gen: Generation) => {
    if (gen.topic) return gen.topic;
    if (gen.content) return gen.content.slice(0, 100);
    return 'No input';
  };

  const getOutputPreview = (gen: Generation) => {
    if (typeof gen.outputs === 'object' && gen.outputs !== null) {
      const firstKey = Object.keys(gen.outputs)[0];
      if (firstKey && gen.outputs[firstKey]) {
        const text = typeof gen.outputs[firstKey] === 'string' 
          ? gen.outputs[firstKey] 
          : JSON.stringify(gen.outputs[firstKey]);
        return text.slice(0, 100);
      }
    }
    return 'No output';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Generation History</h1>
            <p className="text-muted-foreground">
              View and manage your previously generated content
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {(selectedTypes.length > 0 || dateFrom || dateTo) && (
              <Badge variant="secondary" className="ml-2">
                {selectedTypes.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  disabled={selectedTypes.length === 0 && !dateFrom && !dateTo}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Type Filter */}
              <div className="space-y-3">
                <Label>Content Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  {TYPE_OPTIONS.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                      onClick={() => handleTypeToggle(type.id)}
                    >
                      <Checkbox
                        id={type.id}
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={() => handleTypeToggle(type.id)}
                      />
                      <Label htmlFor={type.id} className="cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from">From Date</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">To Date</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pro Upgrade Banner */}
        {shouldShowUpgrade && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium mb-1">Limited History Access</p>
                  <p className="text-sm text-muted-foreground">
                    Your plan includes access to the last <strong>{historyLimit}</strong> generations.
                    If you want unlimited history, upgrade to Pro.
                  </p>
                </div>
                <Button size="sm">
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {reachedHistoryLimit && historyLimit !== null && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm font-medium">
                Free plan allows viewing up to {historyLimit} history items.
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for unlimited history.
              </p>
            </CardContent>
          </Card>
        )}

        {reachedHistoryLimit && historyLimit !== null && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm font-medium">
                Free plan allows viewing up to {historyLimit} history items.
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for unlimited history.
              </p>
            </CardContent>
          </Card>
        )}

        {reachedHistoryLimit && historyLimit !== null && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm font-medium">
                Free plan allows viewing up to {historyLimit} history items.
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for unlimited history.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Content History</CardTitle>
                <CardDescription>
                  {total > 0 ? `${total} generation${total > 1 ? 's' : ''} found` : 'No generations yet'}
                </CardDescription>
              </div>
              {isLoading && <LoadingSpinner size="sm" />}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && generations.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <LoadingSpinner size="lg" />
                  <p className="text-sm text-muted-foreground">Loading history...</p>
                </div>
              </div>
            ) : generations.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="font-medium">No generations found</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTypes.length > 0 || dateFrom || dateTo
                      ? 'Try adjusting your filters'
                      : 'Start creating content to see it here'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {generations.map((gen) => (
                  <div
                    key={gen.id}
                    className="p-4 border rounded-lg hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedGeneration(gen)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{getTypeLabel(gen.source)}</Badge>
                          {gen.platforms.map((platform) => (
                            <Badge key={platform} variant="outline" className="text-xs">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium line-clamp-1">
                            {getInputPreview(gen)}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {getOutputPreview(gen)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(gen.created_at), 'MMM d, yyyy')}
                        </span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {generations.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
                  {historyLimit && total > historyLimit && (
                    <span className="ml-1">
                      (limited to {historyLimit})
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0 || isLoading}
                  >
                    Previous
                  </Button>
                  {canLoadMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={isLoading}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <GenerationDetailModal
          generation={selectedGeneration}
          onClose={() => setSelectedGeneration(null)}
        />
      </div>
    </div>
  );
}

function GenerationDetailModal({
  generation,
  onClose,
}: {
  generation: Generation | null;
  onClose: () => void;
}) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  if (!generation) return null;

  const handleCopy = async (platform: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlatform(platform);
      toast.success(`${platform} content copied!`);
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const outputs = typeof generation.outputs === 'object' ? generation.outputs : {};

  return (
    <Dialog open={!!generation} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                Generation Details
                <Badge variant="secondary" className="ml-2">
                  {generation.source === 'simple' ? 'Multi-Platform' : 
                   generation.source === 'blog' ? 'Blog to SNS' : 
                   'Variations'}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Created {format(new Date(generation.created_at), 'PPp')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Input Section */}
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">Input</h3>
                <div className="bg-muted p-4 rounded-md space-y-2">
                  {generation.topic && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Topic</Label>
                      <p className="text-sm">{generation.topic}</p>
                    </div>
                  )}
                  {generation.content && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Content</Label>
                      <p className="text-sm whitespace-pre-wrap">{generation.content}</p>
                    </div>
                  )}
                  {generation.tone && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Tone</Label>
                      <p className="text-sm">{generation.tone}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Platforms</Label>
                    <div className="flex gap-2 mt-1">
                      {generation.platforms.map((platform) => (
                        <Badge key={platform} variant="outline">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Outputs Section */}
            <div className="space-y-3">
              <h3 className="font-medium">Generated Content</h3>
              <div className="space-y-4">
                {Object.entries(outputs).map(([key, value]) => {
                  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
                  return (
                    <div key={key} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{key}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(key, text)}
                        >
                          {copiedPlatform === key ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
