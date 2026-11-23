import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Sheet, SheetHead } from "~/ui/Sheet";

interface Shortcut {
  keys: string[];
  does: string;
}

const GROUPS: { title: string; keys: Shortcut[] }[] = [
  {
    title: "Anywhere",
    keys: [
      { keys: ["/"], does: "Search this screen" },
      { keys: ["?"], does: "Show these shortcuts" },
    ],
  },
  {
    title: "Cards",
    keys: [
      { keys: ["←", "→", "↑", "↓"], does: "Move between cards" },
      { keys: ["Enter"], does: "Open the card" },
      { keys: ["Esc"], does: "Close it" },
    ],
  },
  {
    title: "Explore",
    keys: [
      { keys: ["W"], does: "Want the card, then on to the next" },
      { keys: ["P"], does: "Pass on a pick, then on to the next" },
    ],
  },
];

/** The desktop's keyboard shortcuts (app/useShortcuts.ts, app/useTileKeys.ts), opened with ? or from the side bar. */
export function KeysSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="Keyboard shortcuts" onClose={onClose}>
      <SheetHead title="Keyboard shortcuts" />
      <div className="keys">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h4 className="keys-head">{g.title}</h4>
            <dl>
              {g.keys.map((k) => (
                <div className="keys-row" key={k.does}>
                  <dt>{k.does}</dt>
                  <dd>
                    <KbdGroup>
                      {k.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
