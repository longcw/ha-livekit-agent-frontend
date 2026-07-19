import type { ToolCall } from '../lib/tool-feed';

function humanize(name: string): string {
  const s = name
    .replace(/^Hass/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : name;
}

function argSummary(args: ToolCall['args']): string {
  if (!args) return '';
  if (typeof args === 'string') return args;
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');
}

/** Compact status line for the agent's recent tool calls. */
export function ToolCards({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (!toolCalls.length) return null;
  const recent = toolCalls.slice(-4);
  return (
    <div className="lk-tools">
      {recent.map((t) => (
        <div className="lk-tool" key={t.callId}>
          <span className="lk-tool-name">{humanize(t.name)}</span>
          <span className="lk-tool-args">{argSummary(t.args)}</span>
          <span className="lk-tool-badge" data-s={t.status}>
            {t.status}
          </span>
        </div>
      ))}
    </div>
  );
}
