import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { shouldPersistQuery } from "./persist";

describe("shouldPersistQuery", () => {
  it("saves the list, binders, picks and prices, but not the catalog or failed queries", () => {
    const qc = new QueryClient();
    qc.setQueryData(["cards"], []);
    qc.setQueryData(["prices"], { asOf: "", items: {} });
    qc.setQueryData(["tcgdex", "sets"], []);
    qc.setQueryData(["catalog"], {});
    const saved = qc
      .getQueryCache()
      .getAll()
      .filter(shouldPersistQuery)
      .map((q) => q.queryKey[0]);
    expect(saved).toEqual(["cards", "prices", "tcgdex"]);
    const failed = qc.getQueryCache().build(qc, { queryKey: ["layouts"] });
    expect(shouldPersistQuery(failed)).toBe(false);
  });
});
