"use client";

import { useRef, useState } from "react";
import { BridgeGameConfig } from "../hooks/useBridgeGame";
import {
  PbnBoard,
  PbnSession,
  boardToGameConfig,
  parsePbnSession,
} from "../lib/pbn";

interface PbnUploadProps {
  onSessionLoad: (session: PbnSession, first: BridgeGameConfig) => void;
}

export function PbnUpload({ onSessionLoad }: PbnUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const session = parsePbnSession(text);
      if (session.boards.length === 0) {
        throw new Error(
          `No boards found for ${session.playerFilter}. Check player names and contracts.`,
        );
      }
      const first = boardToGameConfig(session.boards[0]);
      onSessionLoad(session, first);
      setMessage(
        `${file.name} · ${session.boards.length} boards (${session.playerFilter})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse PBN");
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        ref={inputRef}
        type="file"
        accept=".pbn,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
      >
        Upload PBN
      </button>
      {message && (
        <span className="max-w-[16rem] truncate text-zinc-400" title={message}>
          {message}
        </span>
      )}
      {error && (
        <span className="max-w-[14rem] truncate text-rose-400" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}

export type { PbnBoard, PbnSession };
