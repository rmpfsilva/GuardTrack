import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JOB_SHARE_ROLES } from "@shared/schema";
import { ROLE_LABELS, type PositionRow } from "./shared";

interface PositionsEditorProps {
  positions: PositionRow[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof PositionRow, value: any) => void;
}

export function PositionsEditor({ positions, onAdd, onRemove, onUpdate }: PositionsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">Positions</Label>
        <Button type="button" variant="outline" size="sm" onClick={onAdd} data-testid="button-add-position">
          <Plus className="h-3 w-3 mr-1" />Add Position
        </Button>
      </div>
      {positions.map((pos, index) => (
        <div key={index} className="flex items-end gap-2 p-3 rounded-md border bg-muted/30" data-testid={`position-row-${index}`}>
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={pos.role} onValueChange={(v) => onUpdate(index, 'role', v)}>
              <SelectTrigger data-testid={`select-position-role-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_SHARE_ROLES.map(role => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-xs text-muted-foreground">Count</Label>
            <Input
              type="number"
              min="1"
              value={pos.count}
              onChange={(e) => onUpdate(index, 'count', parseInt(e.target.value) || 1)}
              data-testid={`input-position-count-${index}`}
            />
          </div>
          <div className="w-28">
            <Label className="text-xs text-muted-foreground">Rate (£/hr)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={pos.hourlyRate}
              onChange={(e) => onUpdate(index, 'hourlyRate', e.target.value)}
              data-testid={`input-position-rate-${index}`}
            />
          </div>
          {positions.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              data-testid={`button-remove-position-${index}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      <div className="text-sm text-muted-foreground">
        Total: {positions.reduce((sum, p) => sum + (p.count || 0), 0)} positions across {positions.length} role{positions.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
