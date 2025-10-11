import { MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationDisplayProps {
  latitude: string | null;
  longitude: string | null;
  className?: string;
  showLabel?: boolean;
}

export function LocationDisplay({ latitude, longitude, className = "", showLabel = true }: LocationDisplayProps) {
  if (!latitude || !longitude) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <MapPin className="h-4 w-4" />
        <span>No location data</span>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
        {showLabel && <span className="text-xs text-muted-foreground flex-shrink-0">Location:</span>}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate" data-testid="text-coordinates">
          {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
        </code>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          asChild
          data-testid="button-view-map"
        >
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            View Map
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>
    </div>
  );
}
