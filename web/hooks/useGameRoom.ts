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

export function useGameRoom(roomCode: string, playerName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!playerName || !roomCode) return;

    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? "ws://localhost:8787";
    const wsUrl = `${workerUrl.replace(/^http/, "ws")}/room/${roomCode}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", playerName }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string);

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
      setConnected(false);
      setState((prev) => ({ ...prev, phase: "connecting" }));
    };

    return () => ws.close();
  }, [roomCode, playerName]);

  const send = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

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
