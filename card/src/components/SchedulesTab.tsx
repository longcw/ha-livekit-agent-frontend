import { useMemo, useState } from 'react';
import { executionSummary, type Task, whenLabel } from '../lib/tasks';
import type { TasksApi } from '../lib/tasks-api';

const STATUS_ICON: Record<string, string> = {
  scheduled: 'mdi:clock-outline',
  completed: 'mdi:check-circle-outline',
  cancelled: 'mdi:cancel',
  missed: 'mdi:alert-circle-outline',
};

/** Sort: active first (soonest run), then everything else by newest. */
function order(a: Task, b: Task): number {
  const aActive = a.status === 'scheduled';
  const bActive = b.status === 'scheduled';
  if (aActive !== bActive) return aActive ? -1 : 1;
  if (aActive) return (a.next_run_at ?? '').localeCompare(b.next_run_at ?? '');
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
}

/** The Schedules tab: search + a manageable list of every task. Tap a row to edit; the
 *  inline pause/resume and delete buttons manage a schedule without opening the editor. */
export function SchedulesTab({ api, onOpen }: { api: TasksApi; onOpen: (t: Task) => void }) {
  const { tasks, loading, error, freshId, refresh, save, remove } = api;
  const [q, setQ] = useState('');
  // The one row whose delete is armed (two-tap confirm). Any other interaction clears it.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const openTask = (t: Task) => {
    setConfirmId(null);
    onOpen(t);
  };
  const togglePause = (t: Task) => {
    setConfirmId(null);
    void save(t.id, { enabled: !t.enabled });
  };
  const onDelete = (t: Task) => {
    if (confirmId !== t.id) {
      setConfirmId(t.id); // first tap: arm
      return;
    }
    setConfirmId(null); // second tap: confirm + delete
    void remove(t.id);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? tasks.filter(
          (t) =>
            t.description.toLowerCase().includes(needle) ||
            executionSummary(t).toLowerCase().includes(needle),
        )
      : tasks.slice();
    return rows.sort(order);
  }, [tasks, q]);

  return (
    <div className="lk-schedtab">
      <div className="lk-search">
        <ha-icon icon="mdi:magnify" />
        <input
          className="lk-search-in"
          placeholder="Search schedules"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="lk-iconbtn" onClick={() => void refresh()} aria-label="Refresh">
          <ha-icon icon="mdi:refresh" />
        </button>
      </div>

      <div className="lk-tasklist">
        {error ? (
          <div className="lk-tasks-empty">
            <ha-icon icon="mdi:alert-circle-outline" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="lk-tasks-empty">
            <ha-icon icon="mdi:calendar-blank-outline" />
            <span>{loading ? 'Loading…' : q ? 'No matches' : 'No schedules yet'}</span>
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="lk-taskrow"
              data-fresh={t.id === freshId ? '1' : '0'}
              data-status={t.status}
            >
              <button className="lk-taskrow-main" onClick={() => openTask(t)}>
                <span className="lk-taskrow-icon">
                  <ha-icon icon={STATUS_ICON[t.status] ?? 'mdi:clock-outline'} />
                </span>
                <span className="lk-taskrow-body">
                  <span className="lk-taskrow-desc">{t.description}</span>
                  <span className="lk-taskrow-when">{whenLabel(t)}</span>
                  <span className="lk-taskrow-exec">{executionSummary(t)}</span>
                </span>
                <span className="lk-taskrow-tags">
                  {t.schedule_type === 'recurring' && (
                    <span className="lk-tag">
                      <ha-icon icon="mdi:repeat" />
                    </span>
                  )}
                  {t.status !== 'scheduled' && (
                    <span className="lk-tag lk-tag-muted">{t.status}</span>
                  )}
                  {t.status === 'scheduled' && !t.enabled && (
                    <span className="lk-tag lk-tag-muted">paused</span>
                  )}
                </span>
              </button>
              <div className="lk-taskrow-acts">
                {t.status === 'scheduled' && (
                  <button
                    className="lk-iconbtn"
                    onClick={() => togglePause(t)}
                    aria-label={t.enabled ? 'Pause schedule' : 'Resume schedule'}
                  >
                    <ha-icon icon={t.enabled ? 'mdi:pause' : 'mdi:play'} />
                  </button>
                )}
                <button
                  className="lk-iconbtn lk-taskrow-del"
                  data-armed={t.id === confirmId ? '1' : '0'}
                  onClick={() => onDelete(t)}
                  aria-label={t.id === confirmId ? 'Confirm delete' : 'Delete schedule'}
                >
                  <ha-icon icon={t.id === confirmId ? 'mdi:check' : 'mdi:trash-can-outline'} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
