import { useState } from 'react';
import { useHass } from '../hass/context';
import { useNotifySettings } from '../lib/settings-api';

// The in-HA persistent notification, presented as the first (default-on) channel.
const PERSISTENT = 'persistent_notification';
const TEST_MESSAGE = 'Test notification from your Home Voice assistant.';

interface Row {
  service: string;
  label: string;
  icon: string;
}

type TestState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Settings tab. First section: which channels reminders and scheduled-task alerts go to — a
 * compact checkbox list (Home Assistant's in-app notification is the first, default-on item,
 * then each notify.* device) plus a button that fires a real test to the checked channels.
 * Kept compact so more setting sections can be added below.
 */
export function SettingsTab() {
  const hass = useHass();
  const { available, selected, loading, saving, error, toggle } = useNotifySettings();
  const [test, setTest] = useState<TestState>('idle');

  const rows: Row[] = [
    { service: PERSISTENT, label: 'Home Assistant', icon: 'mdi:bell-outline' },
    ...available.map((t) => ({ service: t.service, label: t.label, icon: 'mdi:cellphone' })),
  ];

  const sendTest = async () => {
    if (!hass || selected.length === 0 || test === 'sending') return;
    setTest('sending');
    try {
      await Promise.all(
        selected.map((ch) =>
          ch === PERSISTENT
            ? hass.callService('persistent_notification', 'create', {
                title: 'Home Voice',
                message: TEST_MESSAGE,
              })
            : hass.callService('notify', ch, { title: 'Home Voice', message: TEST_MESSAGE }),
        ),
      );
      setTest('sent');
    } catch {
      setTest('error');
    }
    setTimeout(() => setTest('idle'), 2800);
  };

  const testLabel =
    test === 'sending' ? 'Sending…' : test === 'sent' ? 'Sent' : test === 'error' ? 'Failed' : 'Send a test';

  return (
    <div className="lk-settings">
      <div className="lk-settings-scroll">
        <section className="lk-set-sec">
          <div className="lk-set-sechead">
            <span className="lk-set-title">Notifications</span>
            {saving && <span className="lk-set-saving">Saving…</span>}
          </div>
          <p className="lk-set-desc">Send reminders and scheduled-task alerts to:</p>

          <div className="lk-checklist" role="group" aria-label="Notification channels">
            {rows.map((r) => {
              const on = selected.includes(r.service);
              return (
                <button
                  key={r.service}
                  className="lk-checkrow"
                  data-on={on ? '1' : '0'}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(r.service)}
                >
                  <span className="lk-check">
                    <ha-icon icon="mdi:check" />
                  </span>
                  <span className="lk-checkrow-ic">
                    <ha-icon icon={r.icon} />
                  </span>
                  <span className="lk-checkrow-label">{r.label}</span>
                </button>
              );
            })}
          </div>

          {!loading && available.length === 0 && (
            <p className="lk-set-hint">
              No phone found — install the Home Assistant app and enable notifications to add a
              device here.
            </p>
          )}

          <button
            className="lk-testbtn"
            data-sent={test === 'sent' ? '1' : '0'}
            disabled={selected.length === 0 || test === 'sending'}
            onClick={sendTest}
          >
            <ha-icon icon={test === 'sent' ? 'mdi:check' : 'mdi:send'} />
            {testLabel}
          </button>

          {(error || test === 'error') && (
            <p className="lk-set-err">{error ?? 'Could not send the test. Check the device.'}</p>
          )}
        </section>
      </div>
    </div>
  );
}
