import { useState, type SubmitEvent } from "react";
import { useToast } from "~/ui/Toast";
import { binderFromCode } from "./shareCode";
import type { Binder } from "./types";

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
      <label>
        Shared binder code
        <textarea
          rows={5}
          placeholder="Paste the code here"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button className="btn primary" type="submit">
        Import binder
      </button>
    </form>
  );
}
