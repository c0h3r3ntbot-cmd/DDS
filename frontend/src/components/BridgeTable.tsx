"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useBridgeGame, BridgeGameConfig } from "../hooks/useBridgeGame";
import {
  Card,
  Seat,
  Suit,
  Trump,
  cardId,
  legalCards,
  nextSeat,
  rankValue,
} from "../lib/bridge";
import { boardToGameConfig, PbnSession } from "../lib/pbn";
import { ChangeContractPopup } from "./ChangeContractPopup";
import { PlayingCard } from "./PlayingCard";
import { PbnUpload } from "./PbnUpload";

/** NT order: Spades, Hearts, Clubs, Diamonds. Suit contracts put trump first. */
const NT_SUIT_ORDER: Suit[] = ["S", "H", "C", "D"];

function suitDisplayOrder(trump: Trump): Suit[] {
  if (trump === "NT") return [...NT_SUIT_ORDER];
  return [trump, ...NT_SUIT_ORDER.filter((s) => s !== trump)];
}

const SEAT_NAME: Record<Seat, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
};

function cardsOfSuit(cards: Card[], suit: Suit): Card[] {
  return cards
    .filter((c) => c.suit === suit)
    .sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
}

function sortRow(cards: Card[], order: Suit[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = order.indexOf(a.suit) - order.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankValue(b.rank) - rankValue(a.rank);
  });
}

interface BridgeTableProps {
  config?: BridgeGameConfig;
}

export function BridgeTable({ config }: BridgeTableProps) {
  const game = useBridgeGame(config);
  const [session, setSession] = useState<PbnSession | null>(null);
  const [activeBoard, setActiveBoard] = useState<number | null>(
    config?.boardNumber ?? null,
  );
  const [contractOpen, setContractOpen] = useState(false);

  function loadBoard(boardNumber: number) {
    const board = session?.boards.find((b) => b.board === boardNumber);
    if (!board) return;
    setActiveBoard(boardNumber);
    game.reset(boardToGameConfig(board));
  }

  const trickBySeat: Partial<Record<Seat, Card>> = {};
  let seat = game.trickLeader;
  for (const card of game.currentTrick) {
    trickBySeat[seat] = card;
    seat = nextSeat(seat);
  }

  const turnLegal =
    !game.trickComplete
      ? new Set(
          legalCards(game.hands[game.currentPlayer], game.currentTrick).map(
            cardId,
          ),
        )
      : null;

  const tricksTaken = game.tricksNS + game.tricksEW;
  const suitOrder = suitDisplayOrder(game.trump);
  const handCtx = { game, turnLegal, suitOrder };

  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[#1a1a1a]">
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 bg-[#111] px-3 py-1.5 text-xs text-zinc-300">
        <div className="relative flex items-center gap-3">
          <span className="font-semibold tracking-wide text-zinc-100">
            Double Dummy
          </span>
          <span className="text-zinc-200">{game.contractLabel}</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setContractOpen((o) => !o)}
              className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
            >
              Change Contract
            </button>
            <ChangeContractPopup
              open={contractOpen}
              initial={{
                level: game.contractLevel,
                trump: game.trump,
                declarer: game.declarer,
              }}
              onClose={() => setContractOpen(false)}
              onConfirm={({ level, trump, declarer }) => {
                game.changeContract(level, trump, declarer);
                setContractOpen(false);
              }}
            />
          </div>
          {game.evaluating && (
            <span className="animate-pulse text-amber-300">Solving…</span>
          )}
          {game.error && (
            <span className="max-w-[14rem] truncate text-rose-400" title={game.error}>
              {game.error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PbnUpload
            onSessionLoad={(nextSession, first) => {
              setSession(nextSession);
              setActiveBoard(nextSession.boards[0]?.board ?? null);
              game.reset(first);
            }}
          />
          <button
            type="button"
            onClick={() => game.undo()}
            disabled={!game.canUndo}
            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              const board = session?.boards.find((b) => b.board === activeBoard);
              if (board) game.reset(boardToGameConfig(board));
              else game.reset(config);
            }}
            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
          >
            Reset
          </button>
        </div>
      </div>

      {session && session.boards.length > 0 && (
        <div className="z-20 flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-[#161616] px-3 py-1.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Boards
          </span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
            {session.boards.map((b) => {
              const selected = b.board === activeBoard;
              return (
                <button
                  key={b.board}
                  type="button"
                  title={b.contract.label}
                  onClick={() => loadBoard(b.board)}
                  className={[
                    "shrink-0 rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
                    selected
                      ? "bg-[#f5d547] text-black"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  ].join(" ")}
                >
                  {b.board}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="relative grid min-h-0 flex-1 grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] bg-[#2d6a35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, #3a8a45 0%, #2d6a35 55%, #245a2c 100%)",
        }}
      >
        {/* North */}
        <div className="col-span-3 row-start-1 flex flex-col items-center pt-1">
          <OverlappingRow seat="N" cards={game.hands.N} {...handCtx} />
          <Nameplate
            seat="N"
            active={game.currentPlayer === "N" && !game.trickComplete}
            className="mt-1"
          />
        </div>

        {/* West */}
        <div className="col-start-1 row-start-2 flex items-center self-center pl-1 pr-1">
          <div className="flex flex-col items-start gap-0.5">
            <Nameplate
              seat="W"
              active={game.currentPlayer === "W" && !game.trickComplete}
              className="mb-1"
            />
            <SuitStacks seat="W" cards={game.hands.W} align="left" {...handCtx} />
          </div>
        </div>

        {/* Center */}
        <div className="relative col-start-2 row-start-2 min-h-[14rem]">
          <div className="absolute inset-0 flex items-center justify-center">
            {game.currentTrick.length === 0 && (
              <div className="rounded-lg bg-[#f5d547] px-5 py-2.5 text-center shadow-md">
                <div className="text-sm font-bold leading-tight text-black">
                  {tricksTaken} Trick{tricksTaken === 1 ? "" : "s"} taken
                </div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-black/80">
                  NS {game.tricksNS}
                  <span className="mx-1.5 text-black/40">|</span>
                  EW {game.tricksEW}
                </div>
              </div>
            )}
          </div>

          {(["N", "E", "S", "W"] as Seat[]).map((s) => {
            const card = trickBySeat[s];
            if (!card) return null;
            const pos: Record<Seat, string> = {
              N: "left-1/2 top-[16%] -translate-x-1/2",
              S: "bottom-[16%] left-1/2 -translate-x-1/2",
              E: "right-[18%] top-1/2 -translate-y-1/2",
              W: "left-[18%] top-1/2 -translate-y-1/2",
            };
            return (
              <div key={s} className={`absolute z-10 ${pos[s]}`}>
                <PlayingCard card={card} size="trick" />
              </div>
            );
          })}
        </div>

        {/* East */}
        <div className="col-start-3 row-start-2 flex items-center justify-end self-center pl-1 pr-1">
          <div className="flex flex-col items-end gap-0.5">
            <Nameplate
              seat="E"
              active={game.currentPlayer === "E" && !game.trickComplete}
              className="mb-1"
            />
            <SuitStacks seat="E" cards={game.hands.E} align="right" {...handCtx} />
          </div>
        </div>

        {/* South */}
        <div className="col-span-3 row-start-3 flex flex-col items-center pb-2">
          <Nameplate
            seat="S"
            active={game.currentPlayer === "S" && !game.trickComplete}
            className="mb-1"
            trailing={
              <span className="ml-3 text-base font-extrabold tabular-nums text-black">
                {game.tricksNS}
              </span>
            }
          />
          <OverlappingRow seat="S" cards={game.hands.S} {...handCtx} />
        </div>
      </div>
    </div>
  );
}

function Nameplate({
  seat,
  active,
  className = "",
  trailing,
}: {
  seat: Seat;
  active: boolean;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={[
        "inline-flex h-5 items-center rounded-sm px-2 text-[11px] font-semibold tracking-wide",
        active
          ? "bg-[#f5d547] text-black shadow-sm"
          : "bg-[#c8c8c8] text-zinc-800",
        className,
      ].join(" ")}
    >
      <span className="mr-1.5 font-bold">{seat}</span>
      <span>{SEAT_NAME[seat]}</span>
      {trailing}
    </div>
  );
}

type HandCtx = {
  game: ReturnType<typeof useBridgeGame>;
  turnLegal: Set<string> | null;
  suitOrder: Suit[];
};

function cardInteraction(
  seat: Seat,
  card: Card,
  { game, turnLegal }: Pick<HandCtx, "game" | "turnLegal">,
) {
  const isTurn = seat === game.currentPlayer && !game.trickComplete;
  const id = cardId(card);
  const legal = isTurn && (turnLegal === null || turnLegal.has(id));
  const dimmed = isTurn && turnLegal !== null && !turnLegal.has(id);
  const tricks =
    isTurn && legal && game.tricksAvailable[id] !== undefined
      ? game.tricksAvailable[id]
      : undefined;
  return {
    id,
    dimmed,
    disabled: !legal,
    tricks,
    onClick: legal ? () => game.playCard(card.suit, card.rank) : undefined,
  };
}

/** North/South: one overlapping horizontal row (trump / NT order leftmost). */
function OverlappingRow({
  seat,
  cards,
  game,
  turnLegal,
  suitOrder,
}: { seat: Seat; cards: Card[] } & HandCtx) {
  const sorted = sortRow(cards, suitOrder);
  return (
    <div className="flex max-w-[min(100%,56rem)] justify-center px-2">
      <div className="flex">
        {sorted.map((card, i) => {
          const props = cardInteraction(seat, card, { game, turnLegal });
          return (
            <div
              key={props.id}
              className={i === 0 ? undefined : "-ml-4"}
              style={{ zIndex: i }}
            >
              <PlayingCard
                card={card}
                zIndex={i}
                dimmed={props.dimmed}
                disabled={props.disabled}
                tricks={props.tricks}
                onClick={props.onClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** East/West: suits stacked vertically (trump / NT order on top). */
function SuitStacks({
  seat,
  cards,
  align,
  game,
  turnLegal,
  suitOrder,
}: {
  seat: Seat;
  cards: Card[];
  align: "left" | "right";
} & HandCtx) {
  return (
    <div
      className={[
        "flex flex-col gap-[3px]",
        align === "right" ? "items-end" : "items-start",
      ].join(" ")}
    >
      {suitOrder.map((suit) => {
        const suitCards = cardsOfSuit(cards, suit);
        if (suitCards.length === 0) {
          return <div key={suit} className="h-2" aria-hidden />;
        }
        return (
          <div key={suit} className="flex">
            {suitCards.map((card, i) => {
              const props = cardInteraction(seat, card, { game, turnLegal });
              return (
                <div
                  key={props.id}
                  className={i === 0 ? undefined : "-ml-4"}
                  style={{ zIndex: i }}
                >
                  <PlayingCard
                    card={card}
                    zIndex={i}
                    dimmed={props.dimmed}
                    disabled={props.disabled}
                    tricks={props.tricks}
                    onClick={props.onClick}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
