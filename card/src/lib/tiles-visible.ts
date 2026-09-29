import { useCallback, useState } from 'react';

const STORAGE_KEY = 'lk-voice-tiles-visible';

/** Whether the device tiles rail is shown, remembered per browser; shown by default. */
export function useTilesVisible(): [boolean, () => void] {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
      return true; // localStorage may be unavailable (private mode / sandboxed iframe)
    }
  });
  const toggle = useCallback(() => {
    setVisible((prev) => {
      try {
        localStorage.setItem(STORAGE_KEY, prev ? '0' : '1');
      } catch {
        // persistence is best-effort
      }
      return !prev;
    });
  }, []);
  return [visible, toggle];
}
