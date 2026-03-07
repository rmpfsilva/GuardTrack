import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Sparkles, Globe, Check, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const PRESET_COLOURS = [
  { label: "GT Blue",  hex: "#2563eb" },
  { label: "Slate",    hex: "#475569" },
  { label: "Red",      hex: "#dc2626" },
  { label: "Green",    hex: "#16a34a" },
  { label: "Orange",   hex: "#ea580c" },
  { label: "Purple",   hex: "#7c3aed" },
  { label: "Teal",     hex: "#0d9488" },
  { label: "Rose",     hex: "#e11d48" },
  { label: "Indigo",   hex: "#4338ca" },
  { label: "Amber",    hex: "#d97706" },
];

interface AIPalette {
  recommended: { hex: string; name: string; reason: string };
  palette: { hex: string; name: string; usage: string }[];
  brandNotes: string;
  siteTitle?: string;
}

interface BrandingSettingsProps {
  companyId: string;
  companyName: string;
  currentColour: string | null | undefined;
  isSuperAdmin?: boolean;
}

export function BrandingSettings({ companyId, companyName, currentColour, isSuperAdmin }: BrandingSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedColour, setSelectedColour] = useState<string>(currentColour ?? "#2563eb");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [aiResult, setAiResult] = useState<AIPalette | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isEffectiveSuperAdmin = isSuperAdmin || user?.role === "super_admin";

  const aiMutation = useMutation({
    mutationFn: async () => {
      setAiError(null);
      const res = await fetch(`/api/admin/companies/${companyId}/branding/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ website_url: websiteUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      return res.json() as Promise<AIPalette>;
    },
    onSuccess: (data) => {
      setAiResult(data);
      setSelectedColour(data.recommended.hex);
    },
    onError: (err: Error) => {
      setAiError(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/admin/companies/${companyId}/branding`, {
        brand_colour: selectedColour,
      });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}`] });
      toast({ title: "Brand colour saved", description: `${companyName}'s theme has been updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function pickColour(hex: string) {
    setSelectedColour(hex);
    setSaved(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Company Branding
        </CardTitle>
        <CardDescription>
          Set a brand colour for <strong>{companyName}</strong>. This themes the GuardTrack dashboard — sidebar, buttons, and schedule colour-coding.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Live preview */}
        <div
          className="rounded-md p-4 flex items-center gap-4 border transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${selectedColour}18 0%, ${selectedColour}06 100%)`,
            borderColor: `${selectedColour}33`,
          }}
          data-testid="branding-preview"
        >
          <div
            className="w-10 h-10 rounded-md flex-shrink-0 transition-all duration-300"
            style={{ background: selectedColour, boxShadow: `0 2px 12px ${selectedColour}44` }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{companyName}</p>
            <p className="text-xs text-muted-foreground">Brand preview</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: selectedColour }}>{selectedColour}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ background: selectedColour }}
            >
              Active
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${selectedColour}18`, color: selectedColour, border: `1px solid ${selectedColour}33` }}
            >
              Badge
            </span>
          </div>
        </div>

        {/* Manual colour input */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Manual colour (hex)</p>
          <div className="flex gap-2">
            <input
              type="color"
              value={selectedColour}
              onChange={(e) => pickColour(e.target.value)}
              className="h-9 w-12 rounded-md border cursor-pointer p-0.5"
              data-testid="input-colour-picker"
            />
            <Input
              value={selectedColour}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) pickColour(v);
              }}
              placeholder="#2563eb"
              className="font-mono"
              data-testid="input-colour-hex"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => pickColour(currentColour ?? "#2563eb")}
              title="Reset to original"
              data-testid="button-reset-colour"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preset swatches */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLOURS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => pickColour(p.hex)}
                title={p.label}
                className="relative w-7 h-7 rounded-md border-2 transition-all"
                style={{
                  background: p.hex,
                  borderColor: selectedColour === p.hex ? "#fff" : "transparent",
                  outline: selectedColour === p.hex ? `2px solid ${p.hex}` : "none",
                  outlineOffset: "1px",
                }}
                data-testid={`swatch-${p.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {selectedColour === p.hex && (
                  <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AI Analysis — super admin only */}
        {isEffectiveSuperAdmin && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">AI Colour Extraction</p>
              <span className="text-xs text-muted-foreground">Super Admin</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the company's website URL and Claude will analyse their brand colours automatically.
            </p>
            <div className="flex gap-2">
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://company.co.uk"
                className="flex-1"
                data-testid="input-website-url"
                onKeyDown={(e) => e.key === "Enter" && !aiMutation.isPending && aiMutation.mutate()}
              />
              <Button
                variant="outline"
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending || !websiteUrl.trim()}
                data-testid="button-analyse-ai"
              >
                {aiMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</>
                ) : (
                  <><Globe className="w-4 h-4 mr-2" />Analyse</>
                )}
              </Button>
            </div>

            {aiError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs" data-testid="ai-error">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiResult && (
              <div className="space-y-3 p-3 rounded-md bg-muted/50 border" data-testid="ai-result">
                {aiResult.siteTitle && (
                  <p className="text-xs text-muted-foreground">
                    Analysed: <strong>{aiResult.siteTitle}</strong>
                  </p>
                )}
                <div>
                  <p className="text-xs font-medium mb-1.5">AI Recommended</p>
                  <button
                    type="button"
                    onClick={() => pickColour(aiResult.recommended.hex)}
                    className="flex items-center gap-3 w-full text-left p-2 rounded-md border hover-elevate transition-all"
                    style={{
                      borderColor: selectedColour === aiResult.recommended.hex ? aiResult.recommended.hex : undefined,
                    }}
                    data-testid="button-ai-recommended"
                  >
                    <div
                      className="w-8 h-8 rounded-md flex-shrink-0"
                      style={{ background: aiResult.recommended.hex }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{aiResult.recommended.name} <span className="font-mono font-normal text-muted-foreground">{aiResult.recommended.hex}</span></p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{aiResult.recommended.reason}</p>
                    </div>
                    {selectedColour === aiResult.recommended.hex && (
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    )}
                  </button>
                </div>

                {aiResult.palette && aiResult.palette.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">Full Palette</p>
                    <div className="space-y-1.5">
                      {aiResult.palette.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => pickColour(c.hex)}
                          className="flex items-center gap-3 w-full text-left p-2 rounded-md border hover-elevate transition-all"
                          style={{
                            borderColor: selectedColour === c.hex ? c.hex : undefined,
                          }}
                          data-testid={`palette-colour-${c.hex.replace("#", "")}`}
                        >
                          <div className="w-6 h-6 rounded flex-shrink-0" style={{ background: c.hex }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold">{c.name} </span>
                            <span className="text-xs font-mono text-muted-foreground">{c.hex}</span>
                            <p className="text-xs text-muted-foreground truncate">{c.usage}</p>
                          </div>
                          {selectedColour === c.hex && (
                            <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.brandNotes && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">{aiResult.brandNotes}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || saved}
          className="w-full"
          data-testid="button-save-brand-colour"
        >
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : saved ? (
            <><Check className="w-4 h-4 mr-2" />Saved!</>
          ) : (
            "Save Brand Colour"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
