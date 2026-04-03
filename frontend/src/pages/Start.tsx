import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../lib/config";
import PageShell from "../components/layout/PageShell";
import DesktopPageHeader from "../components/layout/DesktopPageHeader";
import Button from "../components/ui/Button";
import BottomActionBar from "../components/ui/BottomActionBar";
import { FormField, TextInput } from "../components/ui/FormField";

export default function Start() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [partyName, setPartyName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const partyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches) return;
    nameInputRef.current?.focus();
  }, []);

  async function handleCreateGroup() {
    if (!name.trim() || !partyName.trim()) return;

    const res = await fetch(`${API_URL}/api/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName: name.trim(), partyName: partyName.trim() }),
    });

    if (!res.ok) return;

    const data = await res.json();
    localStorage.setItem("sessionToken", data.sessionToken);
    localStorage.setItem("lastPartyId", data.party.id);
    navigate(`/party/${data.party.id}`);
  }

  const canSubmit = Boolean(name.trim() && partyName.trim());

  return (
    <PageShell className="pb-8 md:pb-28">
      <div className="flex min-h-0 flex-1 flex-col md:min-h-0">
      <button
        type="button"
        onClick={() => (step === 1 ? navigate("/") : setStep(1))}
        className="mb-8 self-start text-left text-sm text-neutral-600 underline md:hidden"
      >
        Back
      </button>

      {/* Mobile: two steps */}
      <div className="md:hidden">
        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
          >
            <FormField label="What's your name?">
              <TextInput
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                autoComplete="name"
              />
            </FormField>
            <BottomActionBar>
              <Button type="submit" variant="primary" fullWidth disabled={!name.trim()}>
                Continue →
              </Button>
            </BottomActionBar>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateGroup();
            }}
          >
            <FormField label="What's the name of your group?">
              <TextInput
                autoFocus
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder=""
              />
            </FormField>
            <BottomActionBar>
              <Button type="submit" variant="primary" fullWidth disabled={!partyName.trim()}>
                Create Group
              </Button>
            </BottomActionBar>
          </form>
        )}
      </div>

      {/* Desktop: single form — inputs top, CTA bottom via justify-between */}
      <form
        className="hidden min-h-0 md:flex md:min-h-0 md:flex-1 md:flex-col md:justify-between"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void handleCreateGroup();
        }}
      >
        <div>
          <DesktopPageHeader title="Your Party" onBack={() => navigate("/")} />
          <FormField label="What's your name?">
            <TextInput
              ref={nameInputRef}
              id="create-desktop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              autoComplete="name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  partyInputRef.current?.focus();
                }
              }}
            />
          </FormField>
          <FormField label="What's the name of your party?" className="mt-6">
            <TextInput
              ref={partyInputRef}
              id="create-desktop-party"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Party Name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void handleCreateGroup();
                }
              }}
            />
          </FormField>
        </div>
        <div className="shrink-0 pt-6">
          <Button type="submit" variant="primary" fullWidth disabled={!canSubmit}>
            Create Party
          </Button>
        </div>
      </form>
      </div>
    </PageShell>
  );
}
