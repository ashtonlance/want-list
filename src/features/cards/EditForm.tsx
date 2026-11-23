import { useState, type SubmitEvent } from "react";
import { SET_LIST } from "~/features/list/Datalists";
import { today } from "~/lib/format";
import { useCardWrites } from "./api";
import { parseLink } from "./quickAdd";
import type { Card, CardPatch, Lang } from "./types";

interface Props {
  card: Card;
  knownSets: readonly string[];
  /** Shown when photos can be uploaded. */
  onPhoto: () => void;
  onSaved: () => void;
}

const money = (v: string): number | null => (v.trim() === "" ? null : Math.round(parseFloat(v) * 100) / 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Every editable field of a card, plus the best shipped deal found for it. */
export function EditForm({ card: c, knownSets, onPhoto, onSaved }: Props) {
  const { save } = useCardWrites();
  const [saving, setSaving] = useState(false);
  const d = c.deal;

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => {
      const x = f.get(k);
      return typeof x === "string" ? x.trim() : "";
    };
    const patch: CardPatch = {
      name: v("name") || c.name,
      number: v("number").replace(/^#/, ""),
      variant: v("variant"),
      set: v("set"),
      lang: v("lang") === "JP" ? "JP" : ("EN" satisfies Lang),
      note: v("note"),
      dhUrl: v("dhUrl") || null,
    };
    const link = v("link");
    if (link !== (c.listing?.url ?? "")) {
      patch.listing = link
        ? { url: link, site: parseLink(link, knownSets)?.site ?? "", addedAt: today() }
        : null;
    }
    const price = money(v("dPrice"));
    const ship = money(v("dShip")) ?? 0;
    if (price != null) {
      patch.deal = {
        site: v("dSite"),
        seller: v("dSeller"),
        condition: v("dCond"),
        url: v("dUrl"),
        price,
        shipping: ship,
        total: round2(price + ship),
        checkedAt: today(),
      };
    }
    // The form stays open until the change is saved, so nothing typed is lost if it isn't.
    setSaving(true);
    void save(c, patch, "Saved").then((ok) => {
      setSaving(false);
      if (ok) onSaved();
    });
  };

  return (
    <form className="edit" onSubmit={submit}>
      <label className="wide">
        Card name
        <input type="text" name="name" defaultValue={c.name} />
      </label>
      <label>
        Number
        <input type="text" name="number" defaultValue={c.number} />
      </label>
      <label>
        Variant
        <input type="text" name="variant" defaultValue={c.variant} />
      </label>
      <label className="wide">
        Set
        <input type="text" name="set" defaultValue={c.set} list={SET_LIST} />
      </label>
      <label>
        Language
        <select name="lang" defaultValue={c.lang}>
          <option value="EN">English</option>
          <option value="JP">Japanese</option>
        </select>
      </label>
      <label>
        Note
        <input type="text" name="note" defaultValue={c.note} />
      </label>
      <label className="wide">
        DoubleHolo page
        <input
          type="url"
          name="dhUrl"
          defaultValue={c.dhUrl ?? ""}
          placeholder="https://doubleholo.com/card/…"
        />
      </label>
      <label className="wide">
        Your listing link
        <input type="url" name="link" defaultValue={c.listing?.url ?? ""} placeholder="https://" />
      </label>
      <h4>Best deal found (shipping included)</h4>
      <label>
        Site
        <input type="text" name="dSite" defaultValue={d?.site ?? ""} placeholder="TCGplayer" />
      </label>
      <label>
        Seller
        <input type="text" name="dSeller" defaultValue={d?.seller ?? ""} />
      </label>
      <label>
        Card price
        <input
          type="number"
          name="dPrice"
          defaultValue={d?.price ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </label>
      <label>
        Shipping
        <input
          type="number"
          name="dShip"
          defaultValue={d?.shipping ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </label>
      <label>
        Condition
        <input type="text" name="dCond" defaultValue={d?.condition ?? ""} placeholder="Near Mint" />
      </label>
      <label className="wide">
        Deal link
        <input type="url" name="dUrl" defaultValue={d?.url ?? ""} placeholder="https://" />
      </label>
      <span />
      <div className="actions">
        <button className="btn primary small" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button className="btn small" type="button" onClick={onPhoto}>
          {c.img ? "Replace photo" : "Add photo"}
        </button>
        <button
          className="btn small"
          type="button"
          onClick={() => void save(c, { deal: null }, "Deal cleared")}
        >
          Clear deal
        </button>
      </div>
    </form>
  );
}
