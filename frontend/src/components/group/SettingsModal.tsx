import { usePartySettings } from "../../context/PartySettingsContext";
import IconImg from "../ui/IconImg";

interface SettingsModalProps {
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "No limit";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} min`;
  return `${m}m ${s}s`;
}

const DURATION_OPTIONS = [
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
  { label: "7 min", value: 420 },
  { label: "10 min", value: 600 },
  { label: "15 min", value: 900 },
  { label: "No limit", value: 0 },
];

const QUEUE_SIZE_OPTIONS = [
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "200", value: 200 },
  { label: "No limit", value: 0 },
];

const PER_USER_OPTIONS = [
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "No limit", value: 0 },
];

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = usePartySettings();

  return (
    <div
      className="fixed inset-0 z-[1000] overflow-y-auto bg-white text-neutral-900 md:bg-app-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[500px] flex-col px-4 pt-4 pb-32 md:max-w-none md:w-full md:justify-center md:px-4 md:pb-28 md:pt-0">
        <div className="flex flex-1 flex-col md:min-h-0 md:items-center md:justify-center md:pb-4 md:pt-0">
          <div className="relative z-10 flex w-full flex-1 flex-col md:max-h-[430px] md:min-h-[430px] md:max-w-[600px] md:overflow-hidden md:rounded-[12px] md:border md:border-app-border md:bg-white">
            <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-0 md:overflow-y-auto md:px-4 md:pb-4 md:pt-0">
              <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-full">
                {/* Mobile header */}
                <header className="mb-4 flex items-center justify-between md:hidden">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 hover:bg-app-surface"
                    aria-label="Close"
                  >
                    <IconImg src="/icons/icon-close.svg" className="h-6 w-6" />
                  </button>
                  <h1 className="flex-1 text-center text-lg font-semibold">Settings</h1>
                  <div className="w-10" />
                </header>

                {/* Desktop header */}
                <div className="relative hidden shrink-0 items-center justify-between border-b border-app-border py-4 md:flex">
                  <div className="z-10 flex w-10 shrink-0 justify-start">
                    <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-app-surface" aria-label="Close">
                      <IconImg src="/icons/icon-close.svg" className="h-6 w-6" />
                    </button>
                  </div>
                  <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-semibold text-neutral-900">
                    Settings
                  </h1>
                  <div className="w-10" />
                </div>

                {!settings ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-neutral-400">Loading…</p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-1 flex-col gap-8 md:mt-6 md:px-4">
                    <SettingRow
                      label="Max song length"
                      description="Songs longer than this can't be added"
                      value={settings.max_song_duration_s}
                      displayValue={formatDuration(settings.max_song_duration_s)}
                      options={DURATION_OPTIONS}
                      onChange={(v) => updateSettings({ max_song_duration_s: v })}
                    />
                    <SettingRow
                      label="Max queue size"
                      description="Total songs allowed in the queue"
                      value={settings.max_queue_size}
                      displayValue={settings.max_queue_size === 0 ? "No limit" : `${settings.max_queue_size} songs`}
                      options={QUEUE_SIZE_OPTIONS}
                      onChange={(v) => updateSettings({ max_queue_size: v })}
                    />
                    <SettingRow
                      label="Max songs per person"
                      description="How many songs each person can add"
                      value={settings.max_songs_per_user}
                      displayValue={settings.max_songs_per_user === 0 ? "No limit" : `${settings.max_songs_per_user} songs`}
                      options={PER_USER_OPTIONS}
                      onChange={(v) => updateSettings({ max_songs_per_user: v })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  value,
  displayValue,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  displayValue: string;
  options: { label: string; value: number }[];
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{label}</div>
          <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
        </div>
        <span className="shrink-0 text-sm font-medium text-neutral-600">{displayValue}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              value === opt.value
                ? "border-app-primaryGreen bg-app-mediumGreen text-app-primaryGreen"
                : "border-app-border bg-white text-neutral-700 hover:bg-app-surface"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
