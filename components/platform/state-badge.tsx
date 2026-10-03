import { Badge } from "@/components/ui/badge";
import { STATE_LABEL, type StudioState } from "@/lib/platform";

const V = { live: "success", draft: "muted", suspended: "destructive" } as const;
export function StateBadge({ state }: { state: StudioState }) {
  return <Badge variant={V[state]}>{STATE_LABEL[state]}</Badge>;
}
