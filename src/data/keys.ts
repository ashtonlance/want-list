import type { DocTableName } from "./docs";

export const docKeys = {
  cards: ["cards"],
  discover: ["discover"],
  layouts: ["layouts"],
} as const satisfies Record<DocTableName, readonly string[]>;

export const queryKeys = {
  prices: ["prices"],
  catalog: ["catalog"],
  editor: (email: string) => ["editor", email] as const,
  tdSets: ["tcgdex", "sets"],
  tdCard: (id: string) => ["tcgdex", "card", id] as const,
  tdList: (key: string) => ["tcgdex", "list", key] as const,
} as const;
