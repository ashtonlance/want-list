import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastApi {
  /** A short message at the bottom of the screen. */
  toast: (message: string) => void;
  /** A message with an Undo button, shown a little longer. */
  toastUndo: (message: string, undo: () => void) => void;
}

interface ToastState {
  message: string;
  undo?: () => void;
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  const show = useCallback((message: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setState({ message, undo, id: ++seq.current });
    timer.current = setTimeout(() => setState(null), undo ? 5000 : 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo<ToastApi>(() => ({ toast: (m) => show(m), toastUndo: (m, u) => show(m, u) }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      {state ? (
        <div className="toast" role="status" key={state.id}>
          {state.message}
          {state.undo ? (
            <>
              {" "}
              <button
                className="toast-undo"
                type="button"
                onClick={() => {
                  setState(null);
                  state.undo?.();
                }}
              >
                Undo
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast needs a ToastProvider");
  return api;
}
