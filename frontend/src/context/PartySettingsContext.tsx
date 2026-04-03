import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { API_URL } from "../lib/config";

export interface PartySettings {
  max_song_duration_s: number;
  max_queue_size: number;
  max_songs_per_user: number;
}

interface PartySettingsContextValue {
  settings: PartySettings | null;
  updateSettings: (patch: Partial<PartySettings>) => void;
}

const PartySettingsContext = createContext<PartySettingsContextValue | null>(null);

export function PartySettingsProvider({ partyId, children }: { partyId: string; children: ReactNode }) {
  const [settings, setSettings] = useState<PartySettings | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sessionToken") ?? "";
    fetch(`${API_URL}/api/parties/${partyId}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PartySettings | null) => {
        if (data) setSettings(data);
      });
  }, [partyId]);

  const updateSettings = useCallback(
    (patch: Partial<PartySettings>) => {
      setSettings((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        const token = localStorage.getItem("sessionToken") ?? "";
        fetch(`${API_URL}/api/parties/${partyId}/settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(next),
        });
        return next;
      });
    },
    [partyId],
  );

  return (
    <PartySettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </PartySettingsContext.Provider>
  );
}

export function usePartySettings() {
  const ctx = useContext(PartySettingsContext);
  if (!ctx) throw new Error("usePartySettings must be inside PartySettingsProvider");
  return ctx;
}

export function usePartySettingsOptional() {
  return useContext(PartySettingsContext);
}
