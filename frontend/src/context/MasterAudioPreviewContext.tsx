import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

type MasterAudioPreviewContextValue = {
  registerMainAudio: (el: HTMLAudioElement | null) => void;
  beginPreview: () => void;
  endPreview: () => void;
};

const MasterAudioPreviewContext = createContext<MasterAudioPreviewContextValue | null>(null);

/** Mutes the party master audio element while any preview is active on this client only. */
export function MasterAudioPreviewProvider({ children }: { children: ReactNode }) {
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedVolumeRef = useRef(1);
  const previewDepthRef = useRef(0);

  const registerMainAudio = useCallback((el: HTMLAudioElement | null) => {
    mainAudioRef.current = el;
    if (el && previewDepthRef.current > 0) {
      savedVolumeRef.current = el.volume;
      el.volume = 0;
    }
  }, []);

  const beginPreview = useCallback(() => {
    const el = mainAudioRef.current;
    if (previewDepthRef.current === 0 && el) {
      savedVolumeRef.current = el.volume;
      el.volume = 0;
    }
    previewDepthRef.current += 1;
  }, []);

  const endPreview = useCallback(() => {
    previewDepthRef.current = Math.max(0, previewDepthRef.current - 1);
    const el = mainAudioRef.current;
    if (previewDepthRef.current === 0 && el) {
      el.volume = savedVolumeRef.current;
    }
  }, []);

  return (
    <MasterAudioPreviewContext.Provider value={{ registerMainAudio, beginPreview, endPreview }}>
      {children}
    </MasterAudioPreviewContext.Provider>
  );
}

export function useMasterAudioPreview() {
  const ctx = useContext(MasterAudioPreviewContext);
  if (!ctx) {
    throw new Error("useMasterAudioPreview must be used within MasterAudioPreviewProvider");
  }
  return ctx;
}

/** For optional preview muting when the tree may omit the provider (e.g. Storybook). */
export function useMasterAudioPreviewOptional() {
  return useContext(MasterAudioPreviewContext);
}
