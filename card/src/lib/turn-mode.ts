// Turn mode: how the user commits speech to the agent.
//   auto   — the model detects turn ends; talk continuously, hands-free.
//   manual — explicit turns: tap to start, End to commit / Cancel to discard.
// The choice persists across reconnects (the card auto-reconnects on tab focus).
import type { CardConfig } from '../hass/store';

export type TurnMode = 'auto' | 'manual';

const STORAGE_KEY = 'lk-voice-turn-mode';

/**
 * The mode to boot in: the user's last explicit choice (persisted), otherwise the card's
 * configured default (`input_mode`), otherwise manual.
 */
export function loadTurnMode(config: CardConfig): TurnMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'manual') return saved;
  } catch {
    // localStorage may be unavailable (private mode / sandboxed iframe) — fall through.
  }
  return config.input_mode === 'auto' ? 'auto' : 'manual';
}

export function saveTurnMode(mode: TurnMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Persistence is best-effort; ignore failures.
  }
}
