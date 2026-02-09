"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ALL_AREAS_VALUE = "all";

export type IssueFiltersProps = {
  area: string;
  setArea: (v: string) => void;
  shift: string;
  setShift: (v: string) => void;
  shiftOptions: string[];
  areaOptions: string[];
  includeGo: boolean;
  setIncludeGo: (v: boolean) => void;
};

export function IssueFilters({
  area,
  setArea,
  shift,
  setShift,
  shiftOptions,
  areaOptions,
  includeGo,
  setIncludeGo,
}: IssueFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="issue-shift" className="text-sm text-muted-foreground whitespace-nowrap">
          Shift
        </Label>
        <Select value={shift} onValueChange={setShift}>
          <SelectTrigger id="issue-shift" className="w-[120px]">
            <SelectValue placeholder="Select shift" />
          </SelectTrigger>
          <SelectContent>
            {shiftOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="issue-area" className="text-sm text-muted-foreground whitespace-nowrap">
          Area
        </Label>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger id="issue-area" className="w-[140px]">
            <SelectValue placeholder="All areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_AREAS_VALUE}>All areas</SelectItem>
            {areaOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="include-go"
          checked={includeGo}
          onCheckedChange={setIncludeGo}
          data-testid="toggle-include-go"
        />
        <Label htmlFor="include-go" className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer">
          Show GO
        </Label>
      </div>
    </div>
  );
}
