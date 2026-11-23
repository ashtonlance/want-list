import { useState, type SubmitEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { SET_LIST } from "~/features/list/Datalists";
import { today } from "~/lib/format";
import { useCardWrites } from "./api";
import { isAutoAsk, usePriceCheck } from "./priceCheck";
import { isManual } from "./pricing";
import { parseLink } from "./quickAdd";
import { NO_ASK, type Card, type CardPatch, type Lang } from "./types";

interface Props {
  card: Card;
  knownSets: readonly string[];
  /** Shown when photos can be uploaded. */
  onPhoto: () => void;
  onSaved: () => void;
}

/** The form sits on the sunken Manage panel, so its fields are drawn on the surface color instead. */
const onPanel = "bg-card";

const money = (v: string): number | null => (v.trim() === "" ? null : Math.round(parseFloat(v) * 100) / 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Every editable field of a card, plus the best shipped deal found for it. */
export function EditForm({ card: c, knownSets, onPhoto, onSaved }: Props) {
  const { save } = useCardWrites();
  const [saving, setSaving] = useState(false);
  const checkPrice = usePriceCheck();
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
    const linkChanged = link !== (c.listing?.url ?? "");
    if (linkChanged) {
      patch.listing = link
        ? { url: link, site: parseLink(link, knownSets)?.site ?? "", addedAt: today() }
        : null;
    }
    // A different card, or a link to a different TCGplayer product, needs matching again: drop the old
    // product and any price the check filled in for it, and check again once saved.
    const tcgId = (url: string) => /tcgplayer\.com\/product\/(\d+)/.exec(url)?.[1] ?? "";
    // Only a TCGplayer link to the same product is the same product.
    const otherProduct = linkChanged && (!tcgId(link) || tcgId(link) !== tcgId(c.listing?.url ?? ""));
    const moved =
      (["name", "number", "variant", "set", "lang"] as const).some((k) => patch[k] !== c[k]) || otherProduct;
    if (moved) {
      patch.tcg = null;
      patch.tcgProduct = null;
      patch.noPrice = null;
      // A seller's ask came with the old link, so it goes with it; a price typed in by hand stays.
      if (isAutoAsk(c.ask) || (linkChanged && !isManual(c.ask))) patch.ask = NO_ASK;
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
      if (ok && moved) void checkPrice({ ...c, ...patch, tcg: null }).catch(() => undefined);
    });
  };

  return (
    <form className="edit" onSubmit={submit}>
      <Label className="wide">
        Card name
        <Input className={onPanel} name="name" defaultValue={c.name} />
      </Label>
      <Label>
        Number
        <Input className={onPanel} name="number" defaultValue={c.number} />
      </Label>
      <Label>
        Variant
        <Input className={onPanel} name="variant" defaultValue={c.variant} />
      </Label>
      <Label className="wide">
        Set
        <Input className={onPanel} name="set" defaultValue={c.set} list={SET_LIST} />
      </Label>
      <Label>
        Language
        <NativeSelect selectClassName={onPanel} name="lang" defaultValue={c.lang}>
          <NativeSelectOption value="EN">English</NativeSelectOption>
          <NativeSelectOption value="JP">Japanese</NativeSelectOption>
        </NativeSelect>
      </Label>
      <Label>
        Note
        <Input className={onPanel} name="note" defaultValue={c.note} />
      </Label>
      <Label className="wide">
        DoubleHolo page
        <Input
          className={onPanel}
          type="url"
          name="dhUrl"
          defaultValue={c.dhUrl ?? ""}
          placeholder="https://doubleholo.com/card/…"
        />
      </Label>
      <Label className="wide">
        Your listing link
        <Input
          className={onPanel}
          type="url"
          name="link"
          defaultValue={c.listing?.url ?? ""}
          placeholder="https://"
        />
      </Label>
      <h4>Best deal found (shipping included)</h4>
      <Label>
        Site
        <Input className={onPanel} name="dSite" defaultValue={d?.site ?? ""} placeholder="TCGplayer" />
      </Label>
      <Label>
        Seller
        <Input className={onPanel} name="dSeller" defaultValue={d?.seller ?? ""} />
      </Label>
      <Label>
        Card price
        <Input
          className={onPanel}
          type="number"
          name="dPrice"
          defaultValue={d?.price ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </Label>
      <Label>
        Shipping
        <Input
          className={onPanel}
          type="number"
          name="dShip"
          defaultValue={d?.shipping ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </Label>
      <Label>
        Condition
        <Input className={onPanel} name="dCond" defaultValue={d?.condition ?? ""} placeholder="Near Mint" />
      </Label>
      <Label className="wide">
        Deal link
        <Input
          className={onPanel}
          type="url"
          name="dUrl"
          defaultValue={d?.url ?? ""}
          placeholder="https://"
        />
      </Label>
      <span />
      <div className="actions">
        <Button size="sm" variant="default" className="flex-1" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button size="sm" className="flex-1" onClick={onPhoto}>
          {c.img ? "Replace photo" : "Add photo"}
        </Button>
        <Button size="sm" className="flex-1" onClick={() => void save(c, { deal: null }, "Deal cleared")}>
          Clear deal
        </Button>
      </div>
    </form>
  );
}
