import { useState } from 'react';
import { type Task, toLocalInput } from '../lib/tasks';

type Kind = 'reminder' | 'instruction';

/** The task's action as the editor shows it; an older task's replayed reminder reads as one. */
function initialAction(task: Task): { kind: Kind; text: string } {
  const e = task.execution ?? {};
  if (e.notification) return { kind: 'reminder', text: e.notification.message };
  if (e.instruction) return { kind: 'instruction', text: e.instruction };
  const reminder = (e.steps ?? []).find((st) => st.tool === 'send_notification');
  const message = reminder?.args?.message;
  return typeof message === 'string'
    ? { kind: 'reminder', text: message }
    : { kind: 'instruction', text: '' };
}

/**
 * Modal editor for a single task. Edits everything — description, schedule (once time or
 * recurring cron), the action (a reminder sent as is, or an instruction the agent carries
 * out in the person's conversation), and enabled — plus delete. Times are entered/shown in the browser's local
 * zone and saved against the task's timezone (a single-home assumption: the browser and the
 * home share a zone).
 */
export function TaskEditor({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [description, setDescription] = useState(task.description);
  const [schedType, setSchedType] = useState<'once' | 'recurring'>(task.schedule_type);
  const [runAt, setRunAt] = useState(toLocalInput(task.run_at ?? task.next_run_at));
  const [cron, setCron] = useState(task.cron ?? '');
  const [action] = useState(() => initialAction(task));
  const [kind, setKind] = useState<Kind>(action.kind);
  const [actionText, setActionText] = useState(action.text);
  const [enabled, setEnabled] = useState(task.enabled);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): Record<string, unknown> => {
    const patch: Record<string, unknown> = { description: description.trim(), enabled };
    if (schedType === 'once') {
      if (!runAt) throw new Error('Pick a date and time.');
      patch.schedule = { type: 'once', run_at: runAt, timezone: task.timezone };
    } else {
      if (!cron.trim()) throw new Error('Enter a cron expression.');
      patch.schedule = { type: 'recurring', cron: cron.trim(), timezone: task.timezone };
    }

    const text = actionText.trim();
    if (!text) {
      throw new Error(kind === 'reminder' ? 'Enter the reminder.' : 'Enter the instruction.');
    }
    patch.execution = kind === 'reminder' ? { notification: { message: text } } : { instruction: text };
    return patch;
  };

  const handleSave = async () => {
    setError(null);
    let patch: Record<string, unknown>;
    try {
      patch = buildPatch();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      await onSave(patch);
      onClose();
    } catch {
      setError('Save failed. Check the scheduler and try again.');
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Delete failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="lk-editor" onClick={onClose}>
      <div className="lk-editor-panel" onClick={(e) => e.stopPropagation()}>
        <div className="lk-editor-head">
          <span>Edit task</span>
          <button className="lk-iconbtn" onClick={onClose} aria-label="Close">
            <ha-icon icon="mdi:close" />
          </button>
        </div>

        <div className="lk-editor-body">
          <label className="lk-field">
            <span className="lk-field-label">Description</span>
            <input
              className="lk-in"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="lk-field">
            <span className="lk-field-label">Schedule</span>
            <div className="lk-seg">
              <button data-on={schedType === 'once' ? '1' : '0'} onClick={() => setSchedType('once')}>
                Once
              </button>
              <button
                data-on={schedType === 'recurring' ? '1' : '0'}
                onClick={() => setSchedType('recurring')}
              >
                Recurring
              </button>
            </div>
            {schedType === 'once' ? (
              <input
                className="lk-in"
                type="datetime-local"
                value={runAt}
                onChange={(e) => setRunAt(e.target.value)}
              />
            ) : (
              <>
                <input
                  className="lk-in lk-mono"
                  placeholder="0 8 * * 1-5"
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                />
                <span className="lk-hint">min hour day-of-month month day-of-week</span>
              </>
            )}
          </div>

          <div className="lk-field">
            <span className="lk-field-label">Action</span>
            <div className="lk-seg">
              <button data-on={kind === 'reminder' ? '1' : '0'} onClick={() => setKind('reminder')}>
                Reminder
              </button>
              <button
                data-on={kind === 'instruction' ? '1' : '0'}
                onClick={() => setKind('instruction')}
              >
                Instruction
              </button>
            </div>
            <textarea
              className="lk-in lk-ta"
              rows={2}
              placeholder={kind === 'reminder' ? 'e.g. Time to leave' : 'e.g. Turn off the bedroom AC'}
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
            />
            <span className="lk-hint">
              {kind === 'reminder'
                ? 'Sent as is to your devices.'
                : 'Sent to your conversation when it fires, and the agent carries it out.'}
            </span>
          </div>

          <label className="lk-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enabled</span>
          </label>

          {error && <div className="lk-editor-error">{error}</div>}
        </div>

        <div className="lk-editor-actions">
          <button className="lk-btn lk-btn-danger" onClick={handleDelete} disabled={busy}>
            {confirmDel ? 'Confirm delete' : 'Delete'}
          </button>
          <span className="lk-spacer" />
          <button className="lk-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="lk-btn lk-btn-accent" onClick={handleSave} disabled={busy}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
