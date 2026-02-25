"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type Phase = "connecting" | "lobby" | "playing" | "reveal";

export interface Player {
  id: string;
  name: string;
  submitted: boolean;
}

export interface Submission {
  name: string;
  word: string;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  wins: number;
  rounds: number;
  submissions: Submission[];
  won: boolean;
}

const INITIAL_STATE: GameState = {
  phase: "connecting",
  players: [],
  wins: 0,
  rounds: 0,
  submissions: [],
  won: false,
};

const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 2_000;

export function useGameRoom(roomCode: string, playerName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  const sendRef = useRef<(msg: object) => void>(() => {});

  useEffect(() => {
    if (!playerName || !roomCode) return;
    mountedRef.current = true;

    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;

    function connect() {
      if (!mountedRef.current) return;

      const base = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";
      const wsUrl = base.replace(/^http/, "ws") + `/room/${roomCode}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      sendRef.current = (msg: object) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      };

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        ws.send(JSON.stringify({ type: "join", playerName }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(event.data as string);

        if (data.type === "pong") return;

        if (data.type === "error") {
          setError(data.message);
          setTimeout(() => setError(null), 3000);
          return;
        }

        if (data.type === "state") {
          setState((prev) => ({
            ...prev,
            phase: data.phase,
            players: data.players,
            wins: data.wins,
            rounds: data.rounds,
            submissions: [],
            won: false,
          }));
        }

        if (data.type === "reveal") {
          setState((prev) => ({
            ...prev,
            phase: "reveal",
            submissions: data.submissions,
            won: data.won,
            wins: data.wins,
            rounds: data.rounds,
          }));
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!mountedRef.current) return;
        setConnected(false);
        setState((prev) => ({ ...prev, phase: "connecting" }));
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [roomCode, playerName]);

  const send = useCallback((msg: object) => sendRef.current(msg), []);

  return {
    state,
    error,
    connected,
    start: () => send({ type: "start" }),
    submit: (word: string) => send({ type: "submit", word }),
    nextRound: () => send({ type: "nextRound" }),
    reset: () => send({ type: "reset" }),
  };
}
