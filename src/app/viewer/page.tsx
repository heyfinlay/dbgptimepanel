"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDuration } from "@/lib/time";
import type { SessionState } from "@/lib/fsm";
import {
  type Driver,
  type Lap,
  useSessionStore,
} from "@/store/useSessionStore";

interface ClassificationRow {
  driver: Driver;
  laps: Lap[];
}

const ViewerPage = () => {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const drivers = useSessionStore((state) => state.drivers);
  const setDrivers = useSessionStore((state) => state.setDrivers);
  const upsertDriver = useSessionStore((state) => state.upsertDriver);
  const removeDriver = useSessionStore((state) => state.removeDriver);
  const laps = useSessionStore((state) => state.laps);
  const setLaps = useSessionStore((state) => state.setLaps);
  const setEvents = useSessionStore((state) => state.setEvents);
  const addEvent = useSessionStore((state) => state.addEvent);
  const addLap = useSessionStore((state) => state.addLap);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData) {
        setError("No session configured.");
        setLoading(false);
        return;
      }

      const [driverResponse, lapResponse, eventResponse] = await Promise.all([
        supabase.from("drivers").select("*").eq("active", true),
        supabase.from("laps").select("*").eq("session_id", sessionData.id),
        supabase.from("events").select("*").eq("session_id", sessionData.id),
      ]);

      if (!active) return;

      if (driverResponse.error || lapResponse.error || eventResponse.error) {
        setError(
          driverResponse.error?.message ||
            lapResponse.error?.message ||
            eventResponse.error?.message ||
            "Failed to load data"
        );
        setLoading(false);
        return;
      }

      setSession({
        id: sessionData.id,
        type: sessionData.type,
        title: sessionData.title,
        target_laps: sessionData.target_laps,
        state: sessionData.state as SessionState,
        race_start_epoch_ms: sessionData.race_start_epoch_ms,
        meta: sessionData.meta ?? {},
      });
      setDrivers(driverResponse.data ?? []);
      setLaps(lapResponse.data ?? []);
      setEvents(eventResponse.data ?? []);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("dbgp-viewer")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          if (!payload.new) return;
          setSession({
            id: payload.new.id,
            type: payload.new.type,
            title: payload.new.title,
            target_laps: payload.new.target_laps,
            state: payload.new.state as SessionState,
            race_start_epoch_ms: payload.new.race_start_epoch_ms,
            meta: payload.new.meta ?? {},
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "laps" },
        (payload) => {
          if (payload.new) {
            addLap(payload.new as Lap);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          if (!payload.new) return;
          addEvent(payload.new as never);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old) {
            removeDriver(payload.old.id as string);
            return;
          }
          if (payload.new) {
            upsertDriver(payload.new as Driver);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [
    addEvent,
    addLap,
    removeDriver,
    setDrivers,
    setEvents,
    setLaps,
    setSession,
    supabase,
    upsertDriver,
  ]);

  const classification: ClassificationRow[] = useMemo(() => {
    return drivers
      .map((driver) => ({
        driver,
        laps: laps
          .filter((lap) => lap.driver_id === driver.id)
          .sort((a, b) => a.lap_index - b.lap_index),
      }))
      .sort((a, b) => {
        if (b.laps.length !== a.laps.length) {
          return b.laps.length - a.laps.length;
        }
        const aLast = a.laps.at(-1)?.absolute_ms ?? Number.MAX_SAFE_INTEGER;
        const bLast = b.laps.at(-1)?.absolute_ms ?? Number.MAX_SAFE_INTEGER;
        return aLast - bLast;
      });
  }, [drivers, laps]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-white">
        <p>Loading live timing…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-white">
        <p className="text-rose-400">{error}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-white">
        <p>No active session.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-slate-950 p-6 text-white">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold">{session.title}</h1>
        <p className="text-sm text-slate-400">State: {session.state}</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/80">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Laps</th>
              <th className="px-4 py-3">Best Lap</th>
              <th className="px-4 py-3">Last Lap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {classification.map(({ driver, laps }, index) => {
              const best = laps.reduce((acc, lap) =>
                !acc || lap.lap_ms < acc.lap_ms ? lap : acc,
              undefined as Lap | undefined);
              const last = laps.at(-1);
              return (
                <tr key={driver.id} className="text-sm">
                  <td className="px-4 py-3 font-semibold">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{driver.name}</div>
                    <div className="text-xs text-slate-400">#{driver.number}</div>
                  </td>
                  <td className="px-4 py-3">{laps.length}</td>
                  <td className="px-4 py-3">
                    {best ? formatDuration(best.lap_ms) : "--:--.---"}
                  </td>
                  <td className="px-4 py-3">
                    {last ? formatDuration(last.lap_ms) : "--:--.---"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
};

export default ViewerPage;
