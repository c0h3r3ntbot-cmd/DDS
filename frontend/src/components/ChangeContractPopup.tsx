"use client";

import { useEffect, useState } from "react";
import { Seat, Trump } from "../lib/bridge";

const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Bidding order: Clubs, Diamonds, Hearts, Spades, NT. */
const STRAINS: { trump: Trump; label: string; red: boolean }[] = [
  { trump: "C", label: "♣", red: false },
  { trump: "D", label: "♦", red: true },
  { trump: "H", label: "♥", red: true },
  { trump: "S", label: "♠", red: false },
  { trump: "NT", label: "NT", red: false },
];

const SEATS: Seat[] = ["N", "E", "S", "W"];

export interface ContractChoice {
  level: number;
  trump: Trump;
  declarer: Seat;
}

interface ChangeContractPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (choice: ContractChoice) => void;
  initial?: Partial<ContractChoice>;
}

export function ChangeContractPopup({
  open,
  onClose,
  onConfirm,
  initial,
}: ChangeContractPopupProps) {
  const [level, setLevel] = useState<number | null>(initial?.level ?? null);
  const [trump, setTrump] = useState<Trump | null>(initial?.trump ?? null);
  const [declarer, setDeclarer] = useState<Seat | null>(initial?.declarer ?? null);

  useEffect(() => {
    if (open) {
      setLevel(initial?.level ?? null);
      setTrump(initial?.trump ?? null);
      setDeclarer(initial?.declarer ?? null);
    }
  }, [open, initial?.level, initial?.trump, initial?.declarer]);

  if (!open) return null;

  const ready = level !== null && trump !== null && declarer !== null;

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-[20rem] rounded-md border border-zinc-600 bg-[#1c1c1c] p-3 shadow-xl">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Select contract
      </div>

      <div className="flex flex-col gap-1">
        {LEVELS.map((lv) => (
          <div key={lv} className="flex items-center gap-1">
            {STRAINS.map((s) => {
              const selected = level === lv && trump === s.trump;
              return (
                <button
                  key={s.trump}
                  type="button"
                  onClick={() => {
                    setLevel(lv);
                    setTrump(s.trump);
                  }}
                  className={[
                    "flex h-7 flex-1 items-center justify-center rounded text-sm font-bold",
                    selected
                      ? "bg-[#f5d547] text-black ring-1 ring-amber-300"
                      : s.red
                        ? "bg-white text-[#c41e3a] hover:bg-zinc-100"
                        : "bg-white text-black hover:bg-zinc-100",
                  ].join(" ")}
                  aria-label={`${lv}${s.label}`}
                >
                  {s.trump === "NT" ? (
                    <span className="text-[11px] tracking-tight">
                      {lv}NT
                    </span>
                  ) : (
                    <span className="leading-none">
                      <span className="text-[11px] tabular-nums">{lv}</span>
                      {s.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Declarer
      </div>
      <div className="flex gap-1">
        {SEATS.map((seat) => {
          const selected = declarer === seat;
          return (
            <button
              key={seat}
              type="button"
              onClick={() => setDeclarer(seat)}
              className={[
                "flex h-8 flex-1 items-center justify-center rounded text-sm font-bold",
                selected
                  ? "bg-[#f5d547] text-black"
                  : "bg-white text-black hover:bg-zinc-100",
              ].join(" ")}
            >
              {seat}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (!ready) return;
            onConfirm({ level: level!, trump: trump!, declarer: declarer! });
          }}
          className={[
            "flex-1 rounded px-2 py-1.5 text-xs font-bold",
            ready
              ? "cursor-pointer bg-black text-white hover:bg-zinc-900"
              : "cursor-not-allowed bg-zinc-600 text-zinc-400",
          ].join(" ")}
        >
          OK
        </button>
      </div>
    </div>
  );
}
