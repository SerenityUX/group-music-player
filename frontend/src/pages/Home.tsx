import { useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import Button from "../components/ui/Button";

export default function Home() {
  const navigate = useNavigate();

  return (
    <PageShell className="pb-8 md:pb-28">
      <div className="flex w-full flex-1 flex-col items-center justify-between text-center max-md:min-h-full md:min-h-full md:justify-between">
        <div className="shrink-0" />

        <div className="shrink-0">
          <h1 className="text-4xl font-semibold tracking-tight md:text-[54px]">Nero Party</h1>
          <p className="mt-2 text-lg text-neutral-600">listen together</p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 md:flex-row md:gap-4">
          <Button variant="primary" fullWidth className="md:flex-1" onClick={() => navigate("/start")}>
            Start a party
          </Button>
          <Button variant="outline" fullWidth className="md:flex-1" onClick={() => navigate("/join")}>
            Join a party
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
