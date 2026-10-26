"use client";

import { Card, Suit, cardId } from "../lib/bridge";

const SUIT_GLYPH: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const RED: Record<Suit, boolean> = {
  S: false,
  H: true,
  D: true,
  C: false,
};

export type CardSize = "hand" | "trick";

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  /** DDS tricks for this card; omit when not the player to act / illegal. */
  tricks?: number;
  size?: CardSize;
  dimmed?: boolean;
  /** Raise z-index for hover / overlap stacks. */
  zIndex?: number;
}

export function PlayingCard({
  card,
  onClick,
  disabled,
  tricks,
  size = "hand",
  dimmed,
  zIndex,
}: PlayingCardProps) {
  const red = RED[card.suit];
  const glyph = SUIT_GLYPH[card.suit];
  const interactive = Boolean(onClick) && !disabled;
  const dims =
    size === "trick"
      ? "h-[4.25rem] w-[3rem] text-[15px]"
      : "h-[3.75rem] w-[2.65rem] text-[14px]";

  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      style={zIndex !== undefined ? { zIndex } : undefined}
      aria-label={`${card.rank}${glyph}${tricks !== undefined ? `, ${tricks} tricks` : ""}`}
      className={[
        "relative shrink-0 select-none rounded-[3px] border border-zinc-400/70",
        "bg-gradient-to-b from-white to-[#f3f3f0] shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        "transition-[transform,filter] duration-100",
        dims,
        red ? "text-[#c41e3a]" : "text-zinc-900",
        dimmed ? "opacity-40 brightness-90" : "",
        interactive
          ? "cursor-pointer hover:-translate-y-1 hover:brightness-105"
          : "cursor-default",
        disabled && onClick ? "cursor-not-allowed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="absolute left-[3px] top-[2px] flex flex-col items-center leading-none">
        <span className="font-bold">{card.rank === "T" ? "10" : card.rank}</span>
        <span className="text-[13px] leading-none">{glyph}</span>
      </span>

      {tricks !== undefined && (
        <span className="absolute bottom-0.5 left-[3px] text-[13px] font-extrabold leading-none text-emerald-600 drop-shadow-[0_0_1px_#fff]">
          {tricks}
        </span>
      )}
    </button>
  );
}

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`;
}

export { cardId, SUIT_GLYPH };
