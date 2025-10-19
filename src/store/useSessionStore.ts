"use client";

import { create } from "zustand";
import type { SessionState } from "@/lib/fsm";

export interface Team {
  id: string;
  name: string;
  color_hex: string;
}

export interface Driver {
  id: string;
  number: number;
  name: string;
  team_id: string | null;
  active: boolean;
}

export interface Session {
  id: string;
  type: "Practice" | "Quali" | "Race";
  title: string;
  target_laps: number;
  state: SessionState;
  race_start_epoch_ms: number | null;
  meta: Record<string, unknown>;
}

export interface Lap {
  id: string;
  session_id: string;
  driver_id: string;
  lap_index: number;
  lap_ms: number;
  absolute_ms: number;
  valid: boolean;
}

export interface EventLog {
  id: string;
  session_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at?: string;
}

interface SessionStore {
  session?: Session;
  drivers: Driver[];
  laps: Lap[];
  events: EventLog[];
  selectedDriverId?: string;
  lastCaptureMs: Record<string, number>;
  setSession: (session: Session) => void;
  setDrivers: (drivers: Driver[]) => void;
  upsertDriver: (driver: Driver) => void;
  removeDriver: (driverId: string) => void;
  setLaps: (laps: Lap[]) => void;
  addLap: (lap: Lap) => void;
  removeLap: (lapId: string) => void;
  setEvents: (events: EventLog[]) => void;
  addEvent: (event: EventLog) => void;
  setSelectedDriver: (driverId: string | undefined) => void;
  canCapture: (driverId: string, now: number) => boolean;
  markCapture: (driverId: string, now: number) => void;
  clear: () => void;
}

const CAPTURE_DEBOUNCE_MS = 1200;

export const useSessionStore = create<SessionStore>((set, get) => ({
  drivers: [],
  laps: [],
  events: [],
  lastCaptureMs: {},
  setSession: (session) => set({ session }),
  setDrivers: (drivers) => set({ drivers }),
  upsertDriver: (driver) =>
    set((state) => {
      const exists = state.drivers.find((d) => d.id === driver.id);
      return {
        drivers: exists
          ? state.drivers.map((d) => (d.id === driver.id ? driver : d))
          : [...state.drivers, driver],
      };
    }),
  removeDriver: (driverId) =>
    set((state) => ({
      drivers: state.drivers.filter((driver) => driver.id !== driverId),
    })),
  setLaps: (laps) => set({ laps }),
  addLap: (lap) =>
    set((state) => ({
      laps: [...state.laps.filter((existing) => existing.id !== lap.id), lap].sort(
        (a, b) => a.lap_index - b.lap_index
      ),
    })),
  removeLap: (lapId) =>
    set((state) => ({
      laps: state.laps.filter((lap) => lap.id !== lapId),
    })),
  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({
      events: [...state.events.filter((e) => e.id !== event.id), event].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      ),
    })),
  setSelectedDriver: (selectedDriverId) => set({ selectedDriverId }),
  canCapture: (driverId, now) => {
    const last = get().lastCaptureMs[driverId];
    if (!last) return true;
    return now - last > CAPTURE_DEBOUNCE_MS;
  },
  markCapture: (driverId, now) =>
    set((state) => ({
      lastCaptureMs: { ...state.lastCaptureMs, [driverId]: now },
    })),
  clear: () =>
    set({
      session: undefined,
      drivers: [],
      laps: [],
      events: [],
      selectedDriverId: undefined,
      lastCaptureMs: {},
    }),
}));
