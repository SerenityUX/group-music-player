import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getSocket, disconnectSocket } from "../lib/socket";
import { API_URL } from "../lib/config";
import { PartySettingsProvider } from "../context/PartySettingsContext";
import GroupView from "../components/group/GroupView";
import PlayView from "../components/PlayView";
import type { Member } from "../types/member";

type GroupVariant = "initial" | "withClose";

export default function Party() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showGroup, setShowGroup] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [groupVariant, setGroupVariant] = useState<GroupVariant>("withClose");

  const isHost = session?.id === party?.host_id;

  const fromHomeGroup = searchParams.get("group") === "1";

  async function handleKick(memberId: number) {
    const token = localStorage.getItem("sessionToken");
    if (!token) return;
    await fetch(`${API_URL}/api/parties/${partyId}/kick/${memberId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function handleStartParty() {
    const token = localStorage.getItem("sessionToken");
    if (!token) return;
    await fetch(`${API_URL}/api/parties/${partyId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  useEffect(() => {
    const token = localStorage.getItem("sessionToken");

    if (!token) {
      navigate(`/join/${partyId}`, { replace: true });
      return;
    }

    fetch(`${API_URL}/api/parties/${partyId}/session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          navigate(`/join/${partyId}`, { replace: true });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;

        const started = data.party.has_started === 1;
        setParty(data.party);
        setSession(data.session);
        setMembers(data.party.sessions ?? []);
        setHasStarted(started);

        if (fromHomeGroup) {
          setShowGroup(true);
          setGroupVariant("withClose");
        } else if (data.session.id === data.party.host_id && !started) {
          setShowGroup(true);
          setGroupVariant("initial");
        } else {
          setShowGroup(false);
          setGroupVariant("withClose");
        }

        setLoading(false);

        const sock = getSocket(token);
        sock.on("members_updated", (updatedMembers: Member[]) => {
          setMembers(updatedMembers);
        });
        sock.on("party_started", () => {
          setHasStarted(true);
          setShowGroup(false);
        });
        sock.on("kicked", () => {
          localStorage.removeItem("sessionToken");
          localStorage.removeItem("lastPartyId");
          disconnectSocket();
          navigate("/", { replace: true });
        });
        sock.connect();
      });

    return () => {
      disconnectSocket();
    };
  }, [partyId, navigate, fromHomeGroup]);

  function openGroupFromPlay() {
    setShowGroup(true);
    setGroupVariant("withClose");
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white text-neutral-600 md:bg-app-surface">
        Loading…
      </div>
    );
  }

  return (
    <PartySettingsProvider partyId={partyId!}>
      <div>
        <PlayView
          partyId={partyId!}
          partyName={party.party_name}
          sessionName={session.name}
          isHost={isHost}
          members={members}
          onShowGroup={openGroupFromPlay}
        />

        {showGroup && (
          <GroupView
            partyId={partyId!}
            partyName={party.party_name}
            hostId={party.host_id}
            isHost={isHost}
            hasStarted={hasStarted}
            members={members}
            showCloseButton={groupVariant === "withClose"}
            fromHome={fromHomeGroup}
            onDesktopBack={() => navigate("/")}
            onKick={handleKick}
            onClose={() => setShowGroup(false)}
            onStartParty={handleStartParty}
          />
        )}
      </div>
    </PartySettingsProvider>
  );
}
