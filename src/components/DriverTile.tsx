"use client";

import { useMemo, useState } from "react";
import { captureLap } from "@/lib/fsm";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDuration, nowUtcMs } from "@/lib/time";
import { type Driver, useSessionStore } from "@/store/useSessionStore";
import { Button } from "./ui/Button";

interface DriverTileProps {
  driver: Driver;
  disabled?: boolean;
  raceStartEpochMs: number | null;
  sessionId: string;
}

export const DriverTile = ({
  driver,
  disabled,
  raceStartEpochMs,
  sessionId,
}: DriverTileProps) => {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const laps = useSessionStore((state) => state.laps);
  const canCapture = useSessionStore((state) => state.canCapture);
  const markCapture = useSessionStore((state) => state.markCapture);

  const driverLaps = useMemo(
    () =>
      laps
        .filter((lap) => lap.driver_id === driver.id)
        .sort((a, b) => a.lap_index - b.lap_index),
    [laps, driver.id]
  );

  const lastLap = driverLaps.at(-1);

  const bestLap = useMemo(() => {
    if (!driverLaps.length) return undefined;
    return driverLaps.reduce((best, lap) => (lap.lap_ms < best.lap_ms ? lap : best));
  }, [driverLaps]);

  const handleCapture = async () => {
    if (!raceStartEpochMs) {
      setError("Race has not started");
      return;
    }
    const now = nowUtcMs();
    if (!canCapture(driver.id, now)) {
      setError("Capture debounced");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await captureLap(supabase, sessionId, driver.id, raceStartEpochMs);
      markCapture(driver.id, now);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const handleUndo = async () => {
    if (!lastLap) return;
    setPending(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("laps")
      .delete()
      .eq("id", lastLap.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      const { error: insertError } = await supabase.from("events").insert({
        session_id: sessionId,
        type: "UNDO",
        payload: { driver_id: driver.id, lap_index: lastLap.lap_index },
      });

      if (insertError) {
        setError(insertError.message);
      }
    }
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">#{driver.number}</p>
          <h3 className="text-xl font-semibold text-slate-100">{driver.name}</h3>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>Laps: {driverLaps.length}</p>
          <p>Best: {bestLap ? formatDuration(bestLap.lap_ms) : "--:--.---"}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={handleCapture}
          disabled={disabled || pending}
        >
          Capture Lap
        </Button>
        <Button
          variant="outline"
          onClick={handleUndo}
          disabled={pending || !lastLap}
        >
          Undo
        </Button>
      </div>
      {lastLap ? (
        <div className="text-xs text-slate-400">
          Last lap: {formatDuration(lastLap.lap_ms)} ({lastLap.lap_index})
        </div>
      ) : (
        <div className="text-xs text-slate-500">No laps captured</div>
      )}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
};

export default DriverTile;
