"use client";

import { useMemo, useState } from "react";
import { finishRace, finalCall, resetSession, startRace } from "@/lib/fsm";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { SessionState } from "@/lib/fsm";
import { Button } from "./ui/Button";

interface FlagToolbarProps {
  sessionId: string;
  state: SessionState;
}

const stateLabel: Record<SessionState, string> = {
  PREP: "Prep",
  FINAL_CALL: "Final Call",
  STARTING: "Starting",
  GREEN: "Green",
  FINISHED: "Finished",
};

export const FlagToolbar = ({ sessionId, state }: FlagToolbarProps) => {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-200">
        State: {stateLabel[state]}
      </span>
      <Button onClick={() => run(() => finalCall(supabase, sessionId))} disabled={busy || state !== "PREP"}>
        Final Call
      </Button>
      <Button onClick={() => run(() => startRace(supabase, sessionId))} disabled={busy || state === "GREEN" || state === "FINISHED"}>
        Start Race
      </Button>
      <Button onClick={() => run(() => finishRace(supabase, sessionId))} disabled={busy || state === "FINISHED"}>
        Finish
      </Button>
      <Button variant="ghost" onClick={() => run(() => resetSession(supabase, sessionId))} disabled={busy}>
        Reset
      </Button>
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </div>
  );
};

export default FlagToolbar;
