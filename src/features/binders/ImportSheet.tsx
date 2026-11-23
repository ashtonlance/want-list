import { useState, type SubmitEvent } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/ui/Toast";
import { binderFromCode } from "./shareCode";
import type { Binder } from "./types";

/** A pasted or shown share code: monospace, 16px so iOS doesn't zoom in on focus. */
export const CODE_FIELD = "font-[ui-monospace,Menlo,monospace] text-base leading-[1.35]";

export function ImportSheet({ onImport }: { onImport: (b: Binder) => void }) {
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = binderFromCode(code);
    if (b) onImport(b);
    else toast("That code didn't work. Copy the whole thing and try again.");
  };
  return (
    <form className="sheet-form" onSubmit={submit}>
      <Label>
        Shared binder code
        <Textarea
          rows={5}
          className={CODE_FIELD}
          placeholder="Paste the code here"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </Label>
      <Button variant="default" type="submit">
        Import binder
      </Button>
    </form>
  );
}
