import { type Task, whenLabel } from '../lib/tasks';

/**
 * The Chat-tab scheduled-task rail: a compact list of active tasks. The task just
 * scheduled/updated is highlighted and pinned to the top. Tapping a task opens the editor
 * (same one the Schedules tab uses) to view details, edit, or delete.
 */
const RAIL_MAX = 3;

export function ScheduledTasks({
  tasks,
  freshId,
  onOpen,
  onSeeAll,
}: {
  tasks: Task[];
  freshId: string | null;
  onOpen: (t: Task) => void;
  onSeeAll: () => void;
}) {
  // Only tasks that will actually fire (paused ones live in the Schedules tab).
  const active = tasks.filter((t) => t.status === 'scheduled' && t.enabled);
  if (active.length === 0) return null;

  const ordered = freshId
    ? [...active].sort((a, b) => (a.id === freshId ? -1 : b.id === freshId ? 1 : 0))
    : active;
  const shown = ordered.slice(0, RAIL_MAX);
  const extra = ordered.length - shown.length;

  return (
    <div className="lk-sched">
      <div className="lk-sched-head">
        <ha-icon icon="mdi:calendar-clock" />
        <span>Scheduled · {active.length}</span>
      </div>
      {shown.map((t) => (
        <button
          className="lk-sched-item"
          key={t.id}
          data-fresh={t.id === freshId ? '1' : '0'}
          onClick={() => onOpen(t)}
        >
          <span className="lk-sched-icon">
            <ha-icon icon={t.schedule_type === 'recurring' ? 'mdi:repeat' : 'mdi:clock-outline'} />
          </span>
          <span className="lk-sched-body">
            <span className="lk-sched-desc">{t.description}</span>
            <span className="lk-sched-when">{whenLabel(t)}</span>
          </span>
          {t.schedule_type === 'recurring' && <span className="lk-sched-badge">Repeats</span>}
        </button>
      ))}
      {extra > 0 && (
        <button className="lk-sched-more" onClick={onSeeAll}>
          +{extra} more in Schedules
        </button>
      )}
    </div>
  );
}
