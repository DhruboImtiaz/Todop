import { RotateCcw, Trash2 } from "lucide-react";
import { useStorage } from "../../hooks/useStorage";
import { TRASH_RETENTION_MS } from "../../utils/planning";
import { runUiAction } from "../../utils/asyncAction";
export function TrashPage({ timestamp }: { timestamp: number }) {
  const { deletedLogs, restoreLog } = useStorage();
  const visible = deletedLogs
    .filter(
      (item) => timestamp - Date.parse(item.deletedAt) < TRASH_RETENTION_MS,
    )
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return (
    <section className="trash-page">
      <div className="day-heading">
        <div>
          <p className="workspace-eyebrow">
            <Trash2 size={14} />A LITTLE PEACE OF MIND
          </p>
          <h1>Recently deleted</h1>
          <p>A change of mind is welcome. Tasks stay here for 30 days.</p>
        </div>
      </div>
      <div className="workspace-panel trash-panel">
        {visible.length === 0 ? (
          <div className="focus-empty">
            <span>
              <Trash2 size={29} />
            </span>
            <h3>Nothing to recover.</h3>
            <p>
              Deleted tasks will appear here,
              <br />
              ready for a second chance.
            </p>
          </div>
        ) : (
          visible.map((item) => (
            <div className="trash-row" key={item.log.id}>
              <div>
                <strong>{item.log.title}</strong>
                <small>
                  {Math.max(
                    1,
                    Math.ceil(
                      (TRASH_RETENTION_MS -
                        (timestamp - Date.parse(item.deletedAt))) /
                        86400000,
                    ),
                  )}{" "}
                  days left to restore · {item.log.subtasks.length} subtasks
                  preserved
                </small>
              </div>
              <button
                className="workspace-secondary"
                onClick={() => runUiAction(() => restoreLog(item.log.id))}
              >
                <RotateCcw size={15} />
                Restore<span className="sr-only"> {item.log.title}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
