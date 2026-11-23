import { MinusIcon, PlusIcon } from "lucide-react";
import { useId, useState, type SubmitEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatMoney } from "~/lib/format";
import { Seg } from "~/ui/Seg";
import { Select } from "~/ui/Select";
import { useCardWrites } from "./api";
import { CONDITION_NAMES, GRADERS, gradeLabel, isGraded, ownedOf, signedMoney, valueEach } from "./owned";
import { tcgMarket } from "./pricing";
import { RAW_CONDITIONS, type Card, type Owned, type RawCondition } from "./types";

type Kind = "raw" | "graded";

const KINDS: { value: Kind; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "graded", label: "Graded" },
];
const CONDITIONS: { value: RawCondition | ""; label: string }[] = [
  { value: "", label: "Not set" },
  ...RAW_CONDITIONS.map((c) => ({ value: c, label: `${c} · ${CONDITION_NAMES[c]}` })),
];

/** The form sits on a sunken panel, so its fields are drawn on the surface color instead. */
const onPanel = "bg-card";
/** A typed money field: blank is "not recorded", anything else rounds to cents. */
function moneyOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** The copies you own of a got card: how many, condition or grade, what you paid and what it's worth. */
export function OwnedSection({ card: c, canWrite }: { card: Card; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const o = ownedOf(c);
  const value = valueEach(c);
  const gain = o.paid != null && value != null ? Math.round((value - o.paid) * o.qty * 100) / 100 : null;
  const summary = [
    o.qty > 1 ? `${o.qty} copies` : "1 copy",
    isGraded(o) ? gradeLabel(o) : o.condition ? CONDITION_NAMES[o.condition] : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sec">
      <h4 className="sec-title">Your copy</h4>
      <div className="owned">
        <div className="owned-sum">
          <span className="owned-line">{summary}</span>
          <dl className="owned-nums">
            <div>
              <dt>Worth{o.qty > 1 ? " each" : ""}</dt>
              <dd className="num">{value != null ? formatMoney(value) : "No price"}</dd>
            </div>
            {o.paid != null ? (
              <div>
                <dt>Paid{o.qty > 1 ? " each" : ""}</dt>
                <dd className="num">{formatMoney(o.paid)}</dd>
              </div>
            ) : null}
            {gain != null ? (
              <div>
                <dt>{gain > 0 ? "Up" : gain < 0 ? "Down" : "Even"}</dt>
                <dd className="num">{signedMoney(gain, formatMoney)}</dd>
              </div>
            ) : null}
          </dl>
          {isGraded(o) && c.owned?.value == null && value != null ? (
            <p className="hint">Worth is the raw card&apos;s price. Set your own value for the slab.</p>
          ) : null}
        </div>
        {canWrite && !editing ? (
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>
      {editing ? <OwnedForm card={c} owned={o} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}

function OwnedForm({ card: c, owned: o, onDone }: { card: Card; owned: Owned; onDone: () => void }) {
  const { save } = useCardWrites();
  const [qty, setQty] = useState(o.qty);
  const [kind, setKind] = useState<Kind>(isGraded(o) ? "graded" : "raw");
  const [condition, setCondition] = useState<RawCondition | "">(o.condition ?? "");
  const [saving, setSaving] = useState(false);
  const graderList = useId();
  const market = tcgMarket(c);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => {
      const v = f.get(k);
      return typeof v === "string" ? v.trim() : "";
    };
    const grader = kind === "graded" ? text("grader").toUpperCase() : "";
    const owned: Owned = {
      qty,
      condition: kind === "raw" && condition ? condition : null,
      grader,
      grade: grader ? text("grade") : "",
      paid: moneyOrNull(f.get("paid")),
      value: moneyOrNull(f.get("value")),
    };
    // Stays open with what was typed if the save doesn't go through.
    setSaving(true);
    const ok = await save(c, { owned }, "Saved");
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <form className="edit owned-form" onSubmit={(e) => void submit(e)}>
      <div className="wide owned-row">
        <span className="owned-label">Copies</span>
        <div className="stepper" role="group" aria-label="Copies">
          <Button
            variant="secondary"
            size="icon"
            aria-label="One fewer"
            disabled={qty <= 1}
            onClick={() => setQty((n) => n - 1)}
          >
            <MinusIcon />
          </Button>
          <output className="num" aria-live="polite">
            {qty}
          </output>
          <Button variant="secondary" size="icon" aria-label="One more" onClick={() => setQty((n) => n + 1)}>
            <PlusIcon />
          </Button>
        </div>
      </div>
      <Seg
        className="wide flex bg-border"
        label="Raw or graded"
        value={kind}
        options={KINDS}
        onChange={setKind}
      />
      {kind === "raw" ? (
        <Label className="wide">
          Condition
          <Select selectClassName={onPanel} value={condition} options={CONDITIONS} onChange={setCondition} />
        </Label>
      ) : (
        <>
          <Label>
            Company
            <Input
              className={onPanel}
              name="grader"
              list={graderList}
              defaultValue={o.grader || "PSA"}
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
            <datalist id={graderList}>
              {GRADERS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Label>
          <Label>
            Grade
            <Input
              className={onPanel}
              name="grade"
              defaultValue={o.grade}
              inputMode="decimal"
              placeholder="10"
              autoComplete="off"
              required
            />
          </Label>
        </>
      )}
      <Label>
        Paid{qty > 1 ? " each" : ""}
        <Input
          className={onPanel}
          type="number"
          name="paid"
          defaultValue={o.paid ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="$"
        />
      </Label>
      <Label>
        Your value{qty > 1 ? " each" : ""}
        <Input
          className={onPanel}
          type="number"
          name="value"
          defaultValue={o.value ?? ""}
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder={market != null ? formatMoney(market) : "Market price"}
        />
      </Label>
      <p className="wide hint">Leave your value blank to use the market price.</p>
      <div className="actions">
        <Button size="sm" variant="default" className="flex-1" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
