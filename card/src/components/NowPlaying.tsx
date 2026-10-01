import { useEffect, useState } from 'react';
import { openMoreInfo, useCardConfig, useHass, useStore } from '../hass/context';
import type { Hass } from '../hass/store';

/** The music server's player, added by this integration when a music server is set up. */
function musicEntity(hass: Hass, configured?: string): string | null {
  if (configured) return hass.states[configured] ? configured : null;
  for (const [id, reg] of Object.entries(hass.entities ?? {})) {
    if (id.startsWith('media_player.') && reg?.platform === 'livekit_voice') return id;
  }
  return null;
}

/** Seconds into the track now, from the position HA last reported and when. */
function livePosition(attrs: Record<string, any>, playing: boolean): number | null {
  const at = attrs.media_position;
  if (typeof at !== 'number') return null;
  if (!playing || !attrs.media_position_updated_at) return at;
  const since = (Date.now() - Date.parse(attrs.media_position_updated_at)) / 1000;
  return Math.min(at + Math.max(since, 0), attrs.media_duration ?? Infinity);
}

/**
 * What the music player is playing, with play/pause, previous/next, stop and volume. Shown
 * only while a track is playing or paused, so stopping it hides the bar; tapping the title
 * opens HA's more-info dialog.
 */
export function NowPlaying() {
  const hass = useHass();
  const config = useCardConfig();
  const host = useStore().host;
  const entityId = hass ? musicEntity(hass, config.music_entity) : null;
  const entity = entityId ? hass?.states[entityId] : undefined;
  const playing = entity?.state === 'playing';
  // the volume slider follows the player except while it is being dragged
  const [dragging, setDragging] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  if (!hass || !entityId || !entity || (entity.state !== 'playing' && entity.state !== 'paused'))
    return null;

  const attrs = entity.attributes;
  const call = (service: string, data: Record<string, any> = {}) =>
    hass.callService('media_player', service, { entity_id: entityId, ...data });
  const volume = Math.round((dragging ?? attrs.volume_level ?? 0) * 100);
  const position = livePosition(attrs, playing);
  const duration = attrs.media_duration;
  const progress = position !== null && duration ? Math.min(position / duration, 1) : null;
  const subtitle = [attrs.media_artist, attrs.source].filter(Boolean).join(' · ');

  return (
    <div className="lk-music" data-playing={playing ? '1' : '0'}>
      <div className="lk-music-row">
        <span className="lk-music-icon">
          <ha-icon icon="mdi:music-note" />
        </span>
        <button className="lk-music-meta" onClick={() => openMoreInfo(host, entityId)}>
          <span className="lk-music-title">{attrs.media_title || 'Music'}</span>
          {subtitle && <span className="lk-music-sub">{subtitle}</span>}
        </button>
        <button className="lk-iconbtn" aria-label="Previous" title="Previous" onClick={() => call('media_previous_track')}>
          <ha-icon icon="mdi:skip-previous" />
        </button>
        <button
          className="lk-iconbtn lk-music-play"
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
          onClick={() => call(playing ? 'media_pause' : 'media_play')}
        >
          <ha-icon icon={playing ? 'mdi:pause' : 'mdi:play'} />
        </button>
        <button className="lk-iconbtn" aria-label="Next" title="Next" onClick={() => call('media_next_track')}>
          <ha-icon icon="mdi:skip-next" />
        </button>
        <button className="lk-iconbtn" aria-label="Stop" title="Stop" onClick={() => call('media_stop')}>
          <ha-icon icon="mdi:stop" />
        </button>
      </div>
      <div className="lk-music-row lk-music-vol">
        <ha-icon icon={volume === 0 ? 'mdi:volume-off' : 'mdi:volume-medium'} />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label="Volume"
          style={{ '--lk-fill': `${volume}%` } as React.CSSProperties}
          onChange={(e) => setDragging(Number(e.currentTarget.value) / 100)}
          onPointerUp={(e) => {
            call('volume_set', { volume_level: Number(e.currentTarget.value) / 100 });
            setDragging(null);
          }}
          onKeyUp={(e) => call('volume_set', { volume_level: Number(e.currentTarget.value) / 100 })}
        />
        <span className="lk-music-num">{volume}</span>
      </div>
      {progress !== null && (
        <div className="lk-music-progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}
