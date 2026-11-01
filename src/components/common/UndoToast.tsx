import { useEffect, useState } from "react";
import { Undo2, X } from "lucide-react";
import { useStorage } from "../../hooks/useStorage";
import { runUiAction } from "../../utils/asyncAction";
export function UndoToast() {
  const { undo, dismissUndo } = useStorage();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      dismissUndo,
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo, dismissUndo]);
  if (!undo) return null;
  return (
    <div className="undo-toast" role="status">
      <span>{undo.message}</span>
      <button
        disabled={busy}
        onClick={() =>
          runUiAction(async () => {
            setBusy(true);
            try {
              await undo.action();
            } finally {
              setBusy(false);
            }
          })
        }
      >
        <Undo2 size={15} />
        Undo
      </button>
      <button onClick={dismissUndo} aria-label="Dismiss undo">
        <X size={15} />
      </button>
    </div>
  );
}
