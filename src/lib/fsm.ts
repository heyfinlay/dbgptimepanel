import type { SupabaseClient } from "@supabase/supabase-js";
import { nowUtcMs } from "./time";

export type SessionState = "PREP" | "FINAL_CALL" | "STARTING" | "GREEN" | "FINISHED";

export const finalCall = async (
  supabase: SupabaseClient,
  sessionId: string
) => {
  const { error } = await supabase
    .from("sessions")
    .update({ state: "FINAL_CALL" })
    .eq("id", sessionId);

  if (error) throw error;

  await supabase.from("events").insert({
    session_id: sessionId,
    type: "FINAL_CALL",
  });
};

export const startRace = async (
  supabase: SupabaseClient,
  sessionId: string
) => {
  const now = nowUtcMs();
  const { error } = await supabase
    .from("sessions")
    .update({
      state: "GREEN",
      race_start_epoch_ms: now,
    })
    .eq("id", sessionId);

  if (error) throw error;

  await supabase.from("events").insert({
    session_id: sessionId,
    type: "RACE_START",
    payload: { start_epoch_ms: now },
  });
};

export const finishRace = async (
  supabase: SupabaseClient,
  sessionId: string
) => {
  const { error } = await supabase
    .from("sessions")
    .update({ state: "FINISHED" })
    .eq("id", sessionId);

  if (error) throw error;

  await supabase.from("events").insert({
    session_id: sessionId,
    type: "FLAG_CHANGE",
    payload: { state: "FINISHED" },
  });
};

export const resetSession = async (
  supabase: SupabaseClient,
  sessionId: string
) => {
  const { error } = await supabase
    .from("sessions")
    .update({
      state: "PREP",
      race_start_epoch_ms: null,
    })
    .eq("id", sessionId);

  if (error) throw error;

  await supabase.from("events").insert({
    session_id: sessionId,
    type: "RESET_SESSION",
  });
};

export const captureLap = async (
  supabase: SupabaseClient,
  sessionId: string,
  driverId: string,
  raceStartEpochMs: number
) => {
  const absoluteMs = nowUtcMs() - raceStartEpochMs;
  const { error } = await supabase.rpc("capture_lap", {
    p_session: sessionId,
    p_driver: driverId,
    p_absolute_ms: absoluteMs,
  });

  if (error) throw error;
};
