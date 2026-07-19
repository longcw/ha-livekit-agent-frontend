import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CardConfig, Hass, HassStore } from './store';

const StoreContext = createContext<HassStore | null>(null);
export const HassStoreProvider = StoreContext.Provider;

export function useStore(): HassStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('HassStore not provided');
  return store;
}

export function useHass(): Hass | null {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot).hass;
}

export function useCardConfig(): CardConfig {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot).config;
}

/** Open Home Assistant's native more-info dialog for an entity. */
export function openMoreInfo(host: HTMLElement | null, entityId: string): void {
  host?.dispatchEvent(
    new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true,
    })
  );
}
