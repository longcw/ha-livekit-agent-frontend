import { useMemo, useRef } from 'react';
import { openMoreInfo, useCardConfig, useHass, useStore } from '../hass/context';
import type { Hass } from '../hass/store';
import { buildTiles, formatState, friendlyName, iconFor, isActive, tapService } from '../lib/entities';
import { useExposedEntities } from '../lib/exposed';
import type { ToolCall } from '../lib/tool-feed';

/**
 * A horizontal rail of live, controllable device tiles from `hass.states`, filtered to
 * voice-exposed entities and ranked by relevance (acted-on devices pinned first). Tap
 * toggles a controllable device; long-press / right-click opens HA's more-info dialog.
 */
export function DeviceTiles({
  agentAreas,
  toolCalls,
  query,
}: {
  agentAreas: string[];
  toolCalls: ToolCall[];
  query: string;
}) {
  const hass = useHass();
  const config = useCardConfig();
  const host = useStore().host;
  const exposed = useExposedEntities(hass);

  const tiles = useMemo(
    () => (hass ? buildTiles(hass, config, { agentAreas, toolCalls, exposed, query }) : []),
    [hass, config, agentAreas, toolCalls, exposed, query]
  );

  if (!hass || tiles.length === 0) return null;

  return (
    <div className="lk-tiles">
      {tiles.map((t) => (
        <Tile key={t.entityId} entityId={t.entityId} touched={t.touched} hass={hass} host={host} />
      ))}
    </div>
  );
}

function Tile({
  entityId,
  touched,
  hass,
  host,
}: {
  entityId: string;
  touched: boolean;
  hass: Hass;
  host: HTMLElement | null;
}) {
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
      data-touched={touched ? '1' : '0'}
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
      <span className="lk-tile-icon">
        <ha-icon icon={iconFor(hass, entityId)} />
      </span>
      <span className="lk-tile-state">{formatState(entity)}</span>
      <span className="lk-tile-name">{friendlyName(hass, entityId)}</span>
    </button>
  );
}
