import { useState } from 'react';
import { type Task, toLocalInput } from '../lib/tasks';

/** A step being edited: the args are kept as raw JSON text so partial edits don't reset. */
interface StepDraft {
  tool: string;
  argsText: string;
}

function initialSteps(task: Task): StepDraft[] {
  return (task.execution?.steps ?? []).map((s) => ({
    tool: s.tool ?? '',
    argsText: s.args && Object.keys(s.args).length ? JSON.stringify(s.args, null, 2) : '',
  }));
}

/**
 * Modal editor for a single task. Edits everything — description, schedule (once time or
 * recurring cron), the action (an ordered list of tool-call steps and/or a natural-language
 * instruction), and enabled — plus delete. Times are entered/shown in the browser's local
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
  const [steps, setSteps] = useState<StepDraft[]>(() => initialSteps(task));
  const [instruction, setInstruction] = useState(task.execution?.instruction ?? '');
  const [enabled, setEnabled] = useState(task.enabled);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => setSteps((s) => [...s, { tool: '', argsText: '' }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const buildPatch = (): Record<string, unknown> => {
    const patch: Record<string, unknown> = { description: description.trim(), enabled };
    if (schedType === 'once') {
      if (!runAt) throw new Error('Pick a date and time.');
      patch.schedule = { type: 'once', run_at: runAt, timezone: task.timezone };
    } else {
      if (!cron.trim()) throw new Error('Enter a cron expression.');
      patch.schedule = { type: 'recurring', cron: cron.trim(), timezone: task.timezone };
    }

    // Build steps, skipping fully-empty rows; a row with args but no tool is an error.
    const builtSteps: { tool: string; args: Record<string, unknown> }[] = [];
    steps.forEach((st, i) => {
      const tool = st.tool.trim();
      if (!tool) {
        if (st.argsText.trim()) throw new Error(`Step ${i + 1}: enter a tool name.`);
        return;
      }
      let args: Record<string, unknown> = {};
      if (st.argsText.trim()) {
        try {
          args = JSON.parse(st.argsText);
        } catch {
          throw new Error(`Step ${i + 1}: args must be valid JSON.`);
        }
      }
      builtSteps.push({ tool, args });
    });
    const instr = instruction.trim();
    if (!builtSteps.length && !instr) {
      throw new Error('Add at least one step or an instruction.');
    }
    patch.execution = { steps: builtSteps, instruction: instr || null };
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
            <span className="lk-field-label">Steps</span>
            <div className="lk-steps">
              {steps.map((st, i) => (
                // Positional key: inputs are fully controlled (value from state[i]), so
                // reconciliation by index is correct here.
                <div className="lk-step" key={i}>
                  <div className="lk-step-head">
                    <span className="lk-step-num">Step {i + 1}</span>
                    <span className="lk-spacer" />
                    <button
                      className="lk-iconbtn"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      aria-label="Move step up"
                    >
                      <ha-icon icon="mdi:arrow-up" />
                    </button>
                    <button
                      className="lk-iconbtn"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      aria-label="Move step down"
                    >
                      <ha-icon icon="mdi:arrow-down" />
                    </button>
                    <button
                      className="lk-iconbtn"
                      onClick={() => removeStep(i)}
                      aria-label="Remove step"
                    >
                      <ha-icon icon="mdi:close" />
                    </button>
                  </div>
                  <input
                    className="lk-in lk-mono"
                    placeholder="HassTurnOn"
                    value={st.tool}
                    onChange={(e) => updateStep(i, { tool: e.target.value })}
                  />
                  <textarea
                    className="lk-in lk-ta lk-mono"
                    rows={2}
                    placeholder='{"name": "主卧 空调"}'
                    value={st.argsText}
                    onChange={(e) => updateStep(i, { argsText: e.target.value })}
                  />
                </div>
              ))}
              <button className="lk-addstep" onClick={addStep}>
                <ha-icon icon="mdi:plus" /> Add step
              </button>
            </div>
          </div>

          <div className="lk-field">
            <span className="lk-field-label">Reply / instruction (optional)</span>
            <textarea
              className="lk-in lk-ta"
              rows={2}
              placeholder="e.g. tell me tomorrow's weather"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <span className="lk-hint">Runs after the steps; leave empty for a silent batch.</span>
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
