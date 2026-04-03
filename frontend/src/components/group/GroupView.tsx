import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Button from "../ui/Button";
import BottomActionBar from "../ui/BottomActionBar";
import IconImg from "../ui/IconImg";
import MemberRow from "./MemberRow";
import SettingsModal from "./SettingsModal";
import type { Member } from "../../types/member";

interface GroupViewProps {
  partyId: string;
  partyName: string;
  hostId: number;
  isHost: boolean;
  hasStarted: boolean;
  members: Member[];
  /** false = host pre-start first screen (no X); true = from home or PlayView */
  showCloseButton: boolean;
  /** true when opened via home → party with ?group=1 (desktop: top bar with back + settings) */
  fromHome?: boolean;
  onDesktopBack?: () => void;
  onKick: (memberId: number) => void;
  onClose: () => void;
  onStartParty: () => void;
}

export default function GroupView({
  partyId,
  partyName,
  hostId,
  isHost,
  hasStarted,
  members,
  showCloseButton,
  fromHome = false,
  onDesktopBack,
  onKick,
  onClose,
  onStartParty,
}: GroupViewProps) {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inviteUrl = `${window.location.origin}/party/${partyId}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allZero = members.every((m) => m.peanut_score === 0);
  const sortedMembers = [...members].sort((a, b) => {
    if (allZero) {
      if (a.id === hostId) return -1;
      if (b.id === hostId) return 1;
      return 0;
    }
    return b.peanut_score - a.peanut_score;
  });

  const memberList = (
    <>
      {sortedMembers.map((m, i) => (
        <MemberRow
          key={m.id}
          rank={i + 1}
          name={m.name}
          peanutScore={m.peanut_score}
          isHost={m.id === hostId}
          showRemove={isHost && m.id !== hostId}
          onRemove={isHost && m.id !== hostId ? () => onKick(m.id) : undefined}
        />
      ))}
    </>
  );

  const urlButtonClass =
    "w-full min-w-0 rounded-lg border border-app-border text-center font-medium text-neutral-800";

  const joinCodeText = (
    <p className="mt-2 text-sm text-neutral-600">
      Party Join Code is <span className="font-bold text-neutral-900">{partyId}</span>
    </p>
  );

  const qrBlockMobile = (
    <>
      <div className="rounded-lg bg-white p-2">
        <QRCodeSVG value={inviteUrl} size={280} />
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? undefined : inviteUrl}
        className={`mt-4 max-w-[312px] px-4 py-4 text-base ${urlButtonClass}`}
      >
        <span className="block truncate">{copied ? "Copied!" : inviteUrl}</span>
      </button>
      {joinCodeText}
    </>
  );

  /** Desktop left column: smaller QR + URL, flex column so it fits the half-width card */
  const qrBlockDesktop = (
    <div className="flex w-full flex-col items-center justify-center gap-3">
      <div className="rounded-lg bg-white p-1.5">
        <QRCodeSVG value={inviteUrl} size={168} />
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? undefined : inviteUrl}
        className={`flex w-full max-w-full shrink-0 px-3 py-2.5 text-sm ${urlButtonClass}`}
      >
        <span className="block min-w-0 flex-1 truncate">{copied ? "Copied!" : inviteUrl}</span>
      </button>
      {joinCodeText}
    </div>
  );

  const footerInner =
    isHost && !hasStarted ? (
      <div className="flex items-stretch gap-3">
        <Button type="button" variant="primary" className="min-h-[54px] flex-1" onClick={onStartParty}>
          Start {partyName}
        </Button>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-lg border border-app-border bg-white"
          aria-label="Settings"
        >
          <IconImg src="/icons/settings.svg" className="h-6 w-6" />
        </button>
      </div>
    ) : null;

  return (
    <>
      {/* Shell mirrors PageShell (incl. pb-28 on md like Home/Start/Join) so the card centers the same */}
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-white text-neutral-900 md:bg-app-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex min-h-dvh w-full max-w-[500px] flex-col px-4 pt-4 pb-32 md:max-w-none md:w-full md:justify-center md:px-4 md:pb-28 md:pt-0">
          <div className="flex flex-1 flex-col md:min-h-0 md:items-center md:justify-center md:pb-4 md:pt-0">
            <div className="flex w-full flex-1 flex-col md:max-h-[430px] md:min-h-[430px] md:max-w-[600px] md:overflow-hidden md:rounded-[12px] md:border md:border-app-border md:bg-white">
              <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-0 md:overflow-y-auto md:px-4 md:pb-4 md:pt-0">
                <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-full">
              {/* Mobile header */}
              <header className="mb-6 flex items-center justify-between md:hidden">
            {showCloseButton ? (
              <button
                type="button"
                onClick={fromHome ? onDesktopBack : onClose}
                className="rounded-full p-2 hover:bg-app-surface"
                aria-label={fromHome ? "Back" : "Close"}
              >
                <IconImg src={fromHome ? "/icons/back.svg" : "/icons/icon-close.svg"} className="h-6 w-6" />
              </button>
            ) : (
              <div className="w-10" />
            )}
                <h1 className="flex-1 text-center text-lg font-semibold">{partyName}</h1>
                <div className="w-10">
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="rounded-full p-2 hover:bg-app-surface"
                      aria-label="Settings"
                    >
                      <IconImg src="/icons/settings.svg" className="h-6 w-6" />
                    </button>
                  )}
                </div>
              </header>

              {/* Desktop: top bar when from home or overlay (not pre-start “from create” flow) */}
              {showCloseButton && (
                <div className="relative hidden shrink-0 items-center justify-between border-b border-app-border py-4 md:flex">
              <div className="z-10 flex w-10 shrink-0 justify-start">
                {fromHome ? (
                  <button
                    type="button"
                    onClick={onDesktopBack}
                    className="rounded-lg p-2 hover:bg-app-surface"
                    aria-label="Back"
                  >
                    <IconImg src="/icons/back.svg" className="h-6 w-6" />
                  </button>
                ) : (
                  <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-app-surface" aria-label="Close">
                    <IconImg src="/icons/icon-close.svg" className="h-6 w-6" />
                  </button>
                )}
              </div>
              <h1 className="absolute left-1/2 top-1/2 max-w-[min(100%,14rem)] -translate-x-1/2 -translate-y-1/2 text-center text-lg font-semibold text-neutral-900">
                {partyName}
              </h1>
              <div className="z-10 flex w-10 shrink-0 justify-end">
                {isHost && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="rounded-lg p-2 hover:bg-app-surface"
                    aria-label="Settings"
                  >
                    <IconImg src="/icons/settings.svg" className="h-6 w-6" />
                  </button>
                )}
                </div>
                </div>
              )}

              {/* Mobile: single column */}
              <div className="flex flex-col md:hidden">
                <div className="flex flex-col items-center">{qrBlockMobile}</div>
                <div className="mt-8 border-t border-app-border pt-6">{memberList}</div>
              </div>

              {/* Desktop: two columns — QR left, members right (pre-start has no top bar above this) */}
              <div className="hidden min-h-0 flex-1 flex-row md:flex">
                <div className="flex min-h-0 w-1/2 flex-col items-stretch justify-center border-app-border p-4 md:border-r">
                  {qrBlockDesktop}
                </div>
                <div className="flex min-h-0 w-1/2 flex-1 flex-col overflow-y-auto p-4">{memberList}</div>
              </div>

              {footerInner && (
                <div className="hidden shrink-0 border-t border-app-border pt-4 md:block">{footerInner}</div>
              )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {footerInner && (
        <div className="md:hidden">
          <BottomActionBar>{footerInner}</BottomActionBar>
        </div>
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
