import { useRef } from 'react';
import { openMoreInfo, useCardConfig, useHass, useStore } from '../hass/context';
import type { Hass } from '../hass/store';
import {
  formatState,
  friendlyName,
  iconFor,
  isActive,
  resolveTileEntities,
  sortTiles,
  tapService,
} from '../lib/entities';

/**
 * Native, live device tiles from `hass.states`. Tap toggles a controllable device
 * (or opens more-info); long-press / right-click always opens HA's more-info dialog.
 */
export function DeviceTiles({ agentAreas }: { agentAreas: string[] }) {
  const hass = useHass();
  const config = useCardConfig();
  const host = useStore().host;
  if (!hass) return null;

  const ids = sortTiles(hass, resolveTileEntities(hass, config, agentAreas));
  if (!ids.length) return null;

  return (
    <div className="lk-tiles">
      {ids.map((id) => (
        <Tile key={id} entityId={id} hass={hass} host={host} />
      ))}
    </div>
  );
}

function Tile({ entityId, hass, host }: { entityId: string; hass: Hass; host: HTMLElement | null }) {
  const entity = hass.states[entityId];
  const longPressed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  if (!entity) return null;

  const active = isActive(entity);
  const moreInfo = () => openMoreInfo(host, entityId);

  const onClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    const svc = tapService(entityId);
    if (svc) hass.callService(svc.domain, svc.service, { entity_id: entityId });
    else moreInfo();
  };

  const onPointerDown = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      moreInfo();
    }, 500);
  };
  const clear = () => window.clearTimeout(timer.current);

  return (
    <button
      className="lk-tile"
      data-active={active ? '1' : '0'}
      title={friendlyName(hass, entityId)}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => {
        e.preventDefault();
        moreInfo();
      }}
    >
      <div className="lk-tile-top">
        <span className="lk-tile-icon">
          <ha-icon icon={iconFor(hass, entityId)} />
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="lk-tile-state">{formatState(entity)}</div>
        <div className="lk-tile-name">{friendlyName(hass, entityId)}</div>
      </div>
    </button>
  );
}
