import { useState } from 'react';
import { type Memory, useMemories } from '../lib/memories-api';

function MemoryRow({
  memory,
  armed,
  onArm,
  onSave,
  onDelete,
}: {
  memory: Memory;
  armed: boolean;
  onArm: () => void;
  onSave: (patch: Partial<Pick<Memory, 'text' | 'shared'>>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const text = draft?.trim();
    setDraft(null);
    if (text && text !== memory.text) onSave({ text });
  };

  return (
    <div className="lk-taskrow lk-memrow">
      {draft === null ? (
        <button className="lk-taskrow-main" onClick={() => setDraft(memory.text)} title="Edit">
          <span className="lk-memrow-text">{memory.text}</span>
        </button>
      ) : (
        <textarea
          className="lk-in lk-memrow-edit"
          value={draft}
          autoFocus
          rows={2}
          maxLength={500}
          onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(null);
            }
          }}
          aria-label="Edit memory"
        />
      )}
      <div className="lk-taskrow-acts">
        <button
          className="lk-iconbtn"
          onClick={() => onSave({ shared: !memory.shared })}
          aria-label={memory.shared ? 'Make it yours only' : 'Share with the household'}
          title={memory.shared ? 'Make it yours only' : 'Share with the household'}
        >
          <ha-icon icon={memory.shared ? 'mdi:account-outline' : 'mdi:home-outline'} />
        </button>
        <button
          className="lk-iconbtn lk-taskrow-del"
          data-armed={armed ? '1' : '0'}
          onClick={() => (armed ? onDelete() : onArm())}
          aria-label={armed ? 'Confirm delete' : 'Delete memory'}
        >
          <ha-icon icon={armed ? 'mdi:check' : 'mdi:trash-can-outline'} />
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  memories,
  shared,
  placeholder,
  confirmId,
  setConfirmId,
  api,
}: {
  title: string;
  desc: string;
  memories: Memory[];
  shared: boolean;
  placeholder: string;
  confirmId: number | null;
  setConfirmId: (id: number | null) => void;
  api: ReturnType<typeof useMemories>;
}) {
  const [draft, setDraft] = useState('');

  return (
    <section className="lk-set-sec lk-mem-sec">
      <div className="lk-set-sechead">
        <span className="lk-set-title">{title}</span>
        <span className="lk-tag lk-tag-muted">{memories.length}</span>
      </div>
      <p className="lk-set-desc">{desc}</p>
      <div className="lk-memlist">
        {memories.map((m) => (
          <MemoryRow
            key={m.id}
            memory={m}
            armed={confirmId === m.id}
            onArm={() => setConfirmId(m.id)}
            onSave={(patch) => {
              setConfirmId(null);
              void api.save(m.id, patch);
            }}
            onDelete={() => {
              setConfirmId(null);
              void api.remove(m.id);
            }}
          />
        ))}
      </div>
      <form
        className="lk-person-add"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft('');
          void api.add(text, shared);
        }}
      >
        <input
          className="lk-search-in"
          placeholder={placeholder}
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`New ${title.toLowerCase()} memory`}
        />
        <button className="lk-testbtn lk-person-addbtn" type="submit" disabled={!draft.trim()}>
          <ha-icon icon="mdi:plus" />
          Add
        </button>
      </form>
    </section>
  );
}

/**
 * Memory tab: what the agent knows from the start of every conversation — the viewer's own
 * memories and the household's. Tap a memory to edit it; the agent sees changes from its
 * next conversation.
 */
export function MemoryTab() {
  const api = useMemories();
  // the one memory whose delete is armed (two-tap confirm)
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const shared = { confirmId, setConfirmId, api };

  return (
    <div className="lk-settings">
      <div className="lk-settings-scroll">
        <Section
          title="Yours"
          desc="Only the agent speaking with you sees these."
          memories={api.memories.filter((m) => !m.shared)}
          shared={false}
          placeholder="e.g. I like the bedroom at 24°"
          {...shared}
        />
        <Section
          title="Household"
          desc="Everyone's agent sees these, e.g. what the family calls a device."
          memories={api.memories.filter((m) => m.shared)}
          shared
          placeholder='e.g. "big light" means the living room ceiling light'
          {...shared}
        />
        {api.error && <p className="lk-set-err">{api.error}</p>}
      </div>
    </div>
  );
}
