import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Upload, Palette, Image as ImageIcon, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlatformSettings {
  backgroundType: 'default' | 'guardtrack' | 'custom';
  customBackgroundUrl: string | null;
  overlayOpacity: number;
}

const BACKGROUND_OPTIONS = [
  { value: 'default', label: 'Default (Solid Color)', description: 'Uses standard theme background' },
  { value: 'guardtrack', label: 'GuardTrack Theme', description: 'Blue security-themed gradient' },
  { value: 'custom', label: 'Custom Image', description: 'Upload your own background image' },
];

export default function PlatformSettings() {
  const { toast } = useToast();
  const [backgroundType, setBackgroundType] = useState<'default' | 'guardtrack' | 'custom'>('default');
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string>('');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(50);
  const [isUploading, setIsUploading] = useState(false);

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/super-admin/platform-settings"],
  });

  useEffect(() => {
    if (settings) {
      setBackgroundType(settings.backgroundType || 'default');
      setCustomBackgroundUrl(settings.customBackgroundUrl || '');
      setOverlayOpacity(settings.overlayOpacity || 50);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<PlatformSettings>) => {
      return apiRequest("PUT", "/api/super-admin/platform-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/platform-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings"] });
      toast({
        title: "Settings saved",
        description: "Platform settings have been updated successfully.",
      });
      window.dispatchEvent(new CustomEvent('platform-settings-changed'));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      backgroundType,
      customBackgroundUrl: customBackgroundUrl || null,
      overlayOpacity,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/super-admin/upload-background', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setCustomBackgroundUrl(data.url);
      toast({
        title: "Image uploaded",
        description: "Background image has been uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload background image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearCustomBackground = () => {
    setCustomBackgroundUrl('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Platform Settings</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Platform Settings</h2>
      </div>

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance" data-testid="tab-appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Background Theme
                </CardTitle>
                <CardDescription>
                  Choose how the app background appears across the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Background Type</Label>
                  <Select 
                    value={backgroundType} 
                    onValueChange={(val) => setBackgroundType(val as typeof backgroundType)}
                  >
                    <SelectTrigger data-testid="select-background-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {backgroundType === 'custom' && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <Label className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Custom Background Image
                    </Label>
                    
                    {customBackgroundUrl ? (
                      <div className="relative">
                        <div 
                          className="w-full h-32 rounded-lg bg-cover bg-center border"
                          style={{ backgroundImage: `url(${customBackgroundUrl})` }}
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={clearCustomBackground}
                          data-testid="button-clear-background"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="background-upload"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                        <Label 
                          htmlFor="background-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {isUploading ? 'Uploading...' : 'Click to upload an image'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PNG, JPG up to 5MB
                          </span>
                        </Label>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Or enter image URL</Label>
                      <Input
                        placeholder="https://example.com/background.jpg"
                        value={customBackgroundUrl}
                        onChange={(e) => setCustomBackgroundUrl(e.target.value)}
                        data-testid="input-background-url"
                      />
                    </div>
                  </div>
                )}

                {backgroundType !== 'default' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Overlay Opacity: {overlayOpacity}%</Label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
                      className="w-full"
                      data-testid="range-overlay-opacity"
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher opacity makes text more readable on the background
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSave} 
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  See how your background will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="relative w-full h-48 rounded-lg overflow-hidden border"
                  style={{
                    background: backgroundType === 'default' 
                      ? 'hsl(var(--background))'
                      : backgroundType === 'guardtrack'
                      ? 'linear-gradient(135deg, hsl(220 70% 20%) 0%, hsl(220 60% 30%) 25%, hsl(220 50% 25%) 50%, hsl(220 70% 18%) 75%, hsl(220 80% 15%) 100%)'
                      : customBackgroundUrl 
                      ? `url(${customBackgroundUrl})`
                      : 'hsl(var(--background))',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {backgroundType !== 'default' && (
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: `rgba(0, 0, 0, ${overlayOpacity / 100})`,
                      }}
                    />
                  )}
                  <div className="relative z-10 p-4 flex flex-col justify-center h-full">
                    <Card className="max-w-xs">
                      <CardContent className="p-4">
                        <p className="text-sm">Sample content card</p>
                        <p className="text-xs text-muted-foreground">This is how cards will look on your background</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
