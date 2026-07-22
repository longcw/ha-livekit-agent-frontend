// Shared task types, tool-name constants, and formatting used by the schedules UI.
// Live data (list/edit/delete) is fetched from the HA scheduler proxy — see tasks-api.ts.

// The worker's scheduling function tools. Completions on the tool feed trigger a refresh of
// the proxy-backed list (see useTasks) and mark the freshly-scheduled task.
export const SCHEDULE_TASK = 'schedule_task';
export const LIST_SCHEDULED_TASKS = 'list_scheduled_tasks';
export const CANCEL_SCHEDULED_TASK = 'cancel_scheduled_task';
export const UPDATE_SCHEDULED_TASK = 'update_scheduled_task';

// Rendered via the schedules UI, so hidden from the inline chat action chips.
export const SCHEDULING_TOOLS = new Set<string>([
  SCHEDULE_TASK,
  LIST_SCHEDULED_TASKS,
  CANCEL_SCHEDULED_TASK,
  UPDATE_SCHEDULED_TASK,
]);

export interface Step {
  tool: string;
  args?: Record<string, unknown>;
}

export interface Execution {
  // Deterministic tool calls, replayed in order at run time (stop at first failure).
  steps: Step[];
  // Optional natural-language instruction run by the LLM after the steps.
  instruction?: string | null;
}

export interface Task {
  id: string;
  description: string;
  schedule_type: 'once' | 'recurring';
  run_at?: string | null;
  cron?: string | null;
  timezone: string;
  execution: Execution;
  status: string; // scheduled | completed | cancelled | missed
  enabled: boolean;
  created_at: string;
  next_run_at?: string | null;
}

// ---- formatting ------------------------------------------------------------

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtHM(h: string, m: string): string {
  const hh = Number.parseInt(h, 10);
  const mm = Number.parseInt(m, 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return `${h}:${m}`;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Best-effort friendly summary of a 5-field cron; falls back to the raw expression. */
export function cronSummary(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return cron || 'Recurring';
  const [m, h, dom, mon, dow] = p;
  const exact = h !== '*' && m !== '*' && !h.includes('/') && !m.includes('/') && !h.includes(',');
  const time = exact ? fmtHM(h, m) : '';
  if (dom === '*' && mon === '*') {
    if (dow === '*') return time ? `Daily at ${time}` : 'Daily';
    if (dow === '1-5') return time ? `Weekdays at ${time}` : 'Weekdays';
    if (dow === '0,6' || dow === '6,0') return time ? `Weekends at ${time}` : 'Weekends';
    const days = dow
      .split(',')
      .map((d) => DOW[Number.parseInt(d, 10) % 7] ?? d)
      .join(', ');
    return time ? `${days} at ${time}` : days || (cron ? `Cron ${cron}` : 'Recurring');
  }
  return time ? `At ${time}` : `Cron ${cron}`;
}

/** The human-readable "when" line for a task. */
export function whenLabel(task: Task): string {
  if (task.schedule_type === 'recurring') {
    const summary = cronSummary(task.cron ?? '');
    const next = task.next_run_at ? ` · next ${fmtDateTime(task.next_run_at)}` : '';
    return summary + next;
  }
  return fmtDateTime(task.next_run_at ?? task.run_at) || 'Scheduled';
}

/** A one-line summary of what a task does: its steps, then its instruction. */
export function executionSummary(task: Task): string {
  const e = task.execution || ({} as Execution);
  const parts: string[] = [];
  for (const s of e.steps ?? []) {
    const args = s.args && Object.keys(s.args).length ? ` ${JSON.stringify(s.args)}` : '';
    parts.push(`${s.tool ?? ''}${args}`);
  }
  if (e.instruction) parts.push(e.instruction);
  return parts.join(' · ');
}

/** Convert an ISO instant to a value for <input type="datetime-local"> (browser-local). */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
