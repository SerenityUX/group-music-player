import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_URL } from "../lib/config";
import PageShell from "../components/layout/PageShell";
import DesktopPageHeader from "../components/layout/DesktopPageHeader";
import Button from "../components/ui/Button";
import BottomActionBar from "../components/ui/BottomActionBar";
import { FormField, TextInput } from "../components/ui/FormField";


export default function Join() {
  const { partyId: partyIdFromUrl } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(partyIdFromUrl ? 2 : 1);
  const [code, setCode] = useState((partyIdFromUrl ?? "").toUpperCase());
  const [partyName, setPartyName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!partyIdFromUrl) return;
    const id = partyIdFromUrl.toUpperCase();
    setCode(id);
    fetch(`${API_URL}/api/parties/${id}/preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.party_name) {
          setPartyName(d.party_name);
          setStep(2);
        }
      });
  }, [partyIdFromUrl]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches || step !== 2) return;
    const id = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [step, partyName]);

  async function validateCodeAndContinue() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError(null);

    const res = await fetch(`${API_URL}/api/parties/${trimmed}/preview`);
    if (!res.ok) {
      setError("Group not found");
      return;
    }
    const data = await res.json();
    setPartyName(data.party_name);
    setStep(2);
  }

  async function handleJoin() {
    const trimmedCode = code.trim().toUpperCase();
    if (!name.trim() || !trimmedCode) return;

    const res = await fetch(`${API_URL}/api/parties/${trimmedCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      alert("Could not join");
      return;
    }

    const data = await res.json();
    localStorage.setItem("sessionToken", data.sessionToken);
    localStorage.setItem("lastPartyId", trimmedCode);
    navigate(`/party/${trimmedCode}`, { replace: true });
  }

  const showBack = !partyIdFromUrl;
  const canJoin = Boolean(name.trim() && code.trim());

  function handleDesktopBack() {
    if (step === 1) navigate("/");
    else setStep(1);
  }

  const joinStep1Mobile = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void validateCodeAndContinue();
      }}
    >
      <FormField label="What's your join code?">
        <TextInput
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder=""
          autoCapitalize="characters"
        />
      </FormField>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <BottomActionBar>
        <Button type="submit" variant="primary" fullWidth disabled={!code.trim()}>
          Continue →
        </Button>
      </BottomActionBar>
    </form>
  );

  const joinStep2Mobile = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleJoin();
      }}
    >
      <FormField label="What's your name?">
        <TextInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </FormField>
      <BottomActionBar>
        <Button type="submit" variant="primary" fullWidth disabled={!name.trim()}>
          Join {partyName || "…"}
        </Button>
      </BottomActionBar>
    </form>
  );

  return (
    <PageShell className="pb-8 md:pb-28">
      <div className="flex min-h-0 flex-1 flex-col md:min-h-0">
      {showBack && (
        <button
          type="button"
          onClick={() => (step === 1 ? navigate("/") : setStep(1))}
          className="mb-8 self-start text-left text-sm text-neutral-600 underline md:hidden"
        >
          Back
        </button>
      )}

      {/* Mobile */}
      <div className="md:hidden">{step === 1 ? joinStep1Mobile : joinStep2Mobile}</div>

      {/* Desktop — same fill + justify-between as Home / Start */}
      <div className="hidden min-h-0 md:flex md:flex-1 md:flex-col md:min-h-0">
        {step === 1 ? (
          <form
            className="flex min-h-0 flex-1 flex-col justify-between md:min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              void validateCodeAndContinue();
            }}
          >
            <div>
              <DesktopPageHeader title="Join Party" showBack={showBack} onBack={handleDesktopBack} />
              <FormField label="What's your join code?">
                <TextInput
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Join Code"
                  autoCapitalize="characters"
                />
              </FormField>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="shrink-0 pt-6">
              <Button type="submit" variant="primary" fullWidth disabled={!code.trim()}>
                Continue
              </Button>
            </div>
          </form>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col justify-between md:min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (canJoin) void handleJoin();
            }}
          >
            <div>
              <DesktopPageHeader title="Join Party" showBack={showBack} onBack={handleDesktopBack} />
              <FormField label="Party name">
                <TextInput
                  id="join-desktop-party"
                  value={partyName}
                  readOnly
                  tabIndex={-1}
                  className="cursor-default text-neutral-800"
                  placeholder=""
                />
              </FormField>
              <FormField label="What's your name?" className="mt-6">
                <TextInput
                  ref={nameInputRef}
                  id="join-desktop-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  autoComplete="name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canJoin) {
                      e.preventDefault();
                      void handleJoin();
                    }
                  }}
                />
              </FormField>
            </div>
            <div className="shrink-0 pt-6">
              <Button type="submit" variant="primary" fullWidth disabled={!canJoin}>
                Join Party
              </Button>
            </div>
          </form>
        )}
      </div>
      </div>
    </PageShell>
  );
}
