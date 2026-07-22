import { useState } from 'react';
import { type Task, toLocalInput } from '../lib/tasks';

/**
 * Modal editor for a single task. Edits everything — description, schedule (once time or
 * recurring cron), the action (instruction text or tool + JSON args), and enabled — plus delete.
 * Times are entered/shown in the browser's local zone and saved against the task's timezone
 * (a single-home assumption: the browser and the home share a zone).
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
  const [execType, setExecType] = useState<'instruction' | 'function_call'>(
    task.execution?.type === 'function_call' ? 'function_call' : 'instruction',
  );
  const [instructionText, setInstructionText] = useState(task.execution?.text ?? '');
  const [toolName, setToolName] = useState(task.execution?.tool ?? '');
  const [argsText, setArgsText] = useState(
    task.execution?.args && Object.keys(task.execution.args).length
      ? JSON.stringify(task.execution.args, null, 2)
      : '',
  );
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
    if (execType === 'instruction') {
      if (!instructionText.trim()) throw new Error('Enter the instruction.');
      patch.execution = { type: 'instruction', text: instructionText.trim() };
    } else {
      if (!toolName.trim()) throw new Error('Enter the tool name.');
      let args: unknown = {};
      if (argsText.trim()) {
        try {
          args = JSON.parse(argsText);
        } catch {
          throw new Error('Args must be valid JSON.');
        }
      }
      patch.execution = { type: 'function_call', tool: toolName.trim(), args };
    }
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
              <button
                data-on={execType === 'instruction' ? '1' : '0'}
                onClick={() => setExecType('instruction')}
              >
                Instruction
              </button>
              <button
                data-on={execType === 'function_call' ? '1' : '0'}
                onClick={() => setExecType('function_call')}
              >
                Function call
              </button>
            </div>
            {execType === 'instruction' ? (
              <textarea
                className="lk-in lk-ta"
                rows={2}
                placeholder="e.g. turn off the master bedroom AC"
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
              />
            ) : (
              <>
                <input
                  className="lk-in lk-mono"
                  placeholder="HassTurnOff"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                />
                <textarea
                  className="lk-in lk-ta lk-mono"
                  rows={3}
                  placeholder='{"name": "主卧 空调"}'
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                />
              </>
            )}
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
