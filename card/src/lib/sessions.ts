import type { ToolCall } from './tool-feed';

// Past voice sessions, persisted to the browser's localStorage (per browser/device),
// capped so the store can't grow without bound.

export interface TranscriptLine {
  id: string;
  user: boolean;
  text: string;
}

export interface StoredSession {
  id: string;
  startedAt: number;
  endedAt: number;
  lines: TranscriptLine[];
  toolCalls: ToolCall[];
}

const KEY = 'livekit_voice_sessions';
const MAX_SESSIONS = 100;

export function loadSessions(): StoredSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Prepend a session (newest first); drops the oldest beyond the cap. No-op if empty. */
export function saveSession(session: StoredSession): void {
  if (!session.lines.length && !session.toolCalls.length) return;
  try {
    const all = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full / unavailable — history is best-effort
  }
}

export function clearSessions(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
