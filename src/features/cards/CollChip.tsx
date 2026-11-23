import { Badge } from "~/components/ui/badge";

/**
 * A collection's name as a small outlined chip; tapping it shows that collection. Keeps the `collchip`
 * class so a list row can lift it above the row's own open button (styles/cards.css).
 */
export function CollChip({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Badge
      asChild
      variant="outline"
      className="collchip cursor-pointer overflow-visible font-medium text-muted-foreground touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:opacity-70"
    >
      <button type="button" title={`Show ${name}`} onClick={onClick}>
        {name}
      </button>
    </Badge>
  );
}
