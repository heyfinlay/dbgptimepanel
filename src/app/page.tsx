"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import Clock from "@/components/Clock";
import DriverTile from "@/components/DriverTile";
import EventLog from "@/components/EventLog";
import FlagToolbar from "@/components/FlagToolbar";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
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

const MAX_COLUMNS = 4;

const OperatorPage = () => {
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
  const addLap = useSessionStore((state) => state.addLap);
  const removeLap = useSessionStore((state) => state.removeLap);
  const addEvent = useSessionStore((state) => state.addEvent);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setError(null);
      const [{ data: sessionData, error: sessionError }] = await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData) {
        setError("No active session found. Create one via Supabase.");
        setLoading(false);
        return;
      }

      const [driverResponse, lapResponse, eventResponse] = await Promise.all([
        supabase.from("drivers").select("*").eq("active", true),
        supabase.from("laps").select("*").eq("session_id", sessionData.id),
        supabase.from("events").select("*").eq("session_id", sessionData.id),
      ]);

      if (!mounted) return;

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

    bootstrap();

    const channel = supabase
      .channel("dbgp-operator")
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
            state: payload.new.state,
            race_start_epoch_ms: payload.new.race_start_epoch_ms,
            meta: payload.new.meta ?? {},
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "laps" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old) {
            removeLap(payload.old.id as string);
            return;
          }
          if (payload.new) {
            addLap(payload.new as Lap);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
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
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [
    addEvent,
    addLap,
    removeDriver,
    removeLap,
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

  const gridColumns = classification.length > 0 ? Math.min(MAX_COLUMNS, classification.length) : 1;
  const gridClassMap = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  } as const;
  const resolvedGridClass = gridClassMap[gridColumns as keyof typeof gridClassMap];

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-400">Loading session data…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-300">{error}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-400">No session configured.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{session.title}</h1>
          <p className="text-sm text-slate-400">Target laps: {session.target_laps}</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <Clock />
          <FlagToolbar sessionId={session.id} state={session.state} />
        </div>
      </header>

      <section
        className={clsx("grid flex-1 gap-4 grid-cols-1 sm:grid-cols-2", resolvedGridClass)}
        aria-label="Driver controls"
      >
        {classification.map(({ driver }) => (
          <DriverTile
            key={driver.id}
            driver={driver}
            disabled={session.state !== "GREEN"}
            raceStartEpochMs={session.race_start_epoch_ms ?? null}
            sessionId={session.id}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-label="Event log">
        <h2 className="text-lg font-semibold text-slate-100">Event Log</h2>
        <EventLog />
      </section>
    </main>
  );
};

export default OperatorPage;
