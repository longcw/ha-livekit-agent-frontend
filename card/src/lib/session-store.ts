// Session persistence in localStorage: a single "current" (in-progress / last) session plus
// a capped history of finalized ones. Continuous save means a refresh never loses the last
// conversation; finalizeCurrent() rolls the current session into history.

export type Role = 'user' | 'agent';

export interface ConvMessage {
  kind: 'message';
  id: string;
  role: Role;
  text: string;
  ts: number;
}

export interface ConvAction {
  kind: 'action';
  id: string;
  ts: number;
  name: string;
  args: Record<string, unknown> | string | null;
  status: 'running' | 'done' | 'error' | 'cancelled';
}

export type ConvItem = ConvMessage | ConvAction;

export interface StoredSession {
  id: string;
  startedAt: number;
  endedAt: number;
  items: ConvItem[];
}

const CURRENT_KEY = 'lk_voice_current';
const HISTORY_KEY = 'lk_voice_history';
const MAX_SESSIONS = 100;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — persistence is best-effort */
  }
}

export function loadCurrent(): StoredSession | null {
  return read<StoredSession | null>(CURRENT_KEY, null);
}

export function saveCurrent(session: StoredSession): void {
  write(CURRENT_KEY, session);
}

export function clearCurrent(): void {
  try {
    localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadHistory(): StoredSession[] {
  const value = read<StoredSession[]>(HISTORY_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

/** Move the current session (if it has content) to the front of history; returns it. */
export function finalizeCurrent(): StoredSession | null {
  const current = loadCurrent();
  clearCurrent();
  if (!current || !current.items.length) return null;
  write(HISTORY_KEY, [current, ...loadHistory()].slice(0, MAX_SESSIONS));
  return current;
}
