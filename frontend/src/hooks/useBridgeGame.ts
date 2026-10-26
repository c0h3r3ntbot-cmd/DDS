"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Hands,
  Rank,
  Seat,
  Suit,
  Trump,
  cardId,
  handsToPbn,
  legalCards,
  lho,
  nextSeat,
  parseCard,
  parsePbnDeal,
  removeCard,
  sameCard,
  trickWinner,
} from "../lib/bridge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Classic sample deal (South declares hearts; West on lead). */
export const SAMPLE_PBN =
  "N:QJ6.K652.J85.T98 A843.AQJ97.Q6.K4 K72.T83.AT93.QJ7 T95.4.K742.A6532";

export interface BridgeGameConfig {
  pbn?: string;
  trump?: Trump;
  declarer?: Seat;
  /** Contract level 1–7 (optional; inferred from label when omitted). */
  contractLevel?: number;
  /** Display string e.g. "4♥ South". */
  contractLabel?: string;
  boardNumber?: number;
}

/** Board fields restored by undo (excludes DDS fetch status). */
type BoardSnapshot = {
  currentPlayer: Seat;
  hands: Hands;
  currentTrick: Card[];
  trickLeader: Seat;
  trickComplete: boolean;
  tricksNS: number;
  tricksEW: number;
};

export interface BridgeGameState {
  initialPbn: string;
  trump: Trump;
  declarer: Seat;
  contractLevel: number;
  contractLabel: string;
  boardNumber: number | null;
  currentPlayer: Seat;
  hands: Hands;
  currentTrick: Card[];
  /** Seat that led (or will lead) the current trick. */
  trickLeader: Seat;
  /** True while a completed trick is shown before clearing. */
  trickComplete: boolean;
  tricksNS: number;
  tricksEW: number;
  /** Map of card id -> tricks available for the side on play. */
  tricksAvailable: Record<string, number>;
  evaluating: boolean;
  error: string | null;
  canUndo: boolean;
  playCard: (suit: Suit, rank: Rank) => void;
  undo: () => void;
  reset: (config?: BridgeGameConfig) => void;
  /** Keep the same deal; apply a new contract and restart play from the opening lead. */
  changeContract: (level: number, trump: Trump, declarer: Seat) => void;
  isLegal: (suit: Suit, rank: Rank) => boolean;
}

function snapshotBoard(s: BoardSnapshot): BoardSnapshot {
  return {
    currentPlayer: s.currentPlayer,
    hands: {
      N: [...s.hands.N],
      E: [...s.hands.E],
      S: [...s.hands.S],
      W: [...s.hands.W],
    },
    currentTrick: [...s.currentTrick],
    trickLeader: s.trickLeader,
    trickComplete: s.trickComplete,
    tricksNS: s.tricksNS,
    tricksEW: s.tricksEW,
  };
}

export function formatContractLabel(
  level: number,
  trump: Trump,
  declarer: Seat,
): string {
  const glyph: Record<Trump, string> = {
    S: "♠",
    H: "♥",
    D: "♦",
    C: "♣",
    NT: "NT",
  };
  const names: Record<Seat, string> = {
    N: "North",
    E: "East",
    S: "South",
    W: "West",
  };
  return `${level}${glyph[trump]} ${names[declarer]}`;
}

function levelFromLabel(label: string | undefined, fallback: number): number {
  if (!label) return fallback;
  const m = label.trim().match(/^(\d+)/);
  if (!m) return fallback;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? n : fallback;
}

function initFromConfig(config?: BridgeGameConfig) {
  const initialPbn = config?.pbn ?? SAMPLE_PBN;
  const trump: Trump = config?.trump ?? "H";
  const declarer: Seat = config?.declarer ?? "S";
  const leader = lho(declarer);
  const contractLevel =
    config?.contractLevel ?? levelFromLabel(config?.contractLabel, 4);
  const contractLabel =
    config?.contractLabel ?? formatContractLabel(contractLevel, trump, declarer);
  return {
    initialPbn,
    trump,
    declarer,
    contractLevel,
    contractLabel,
    boardNumber: config?.boardNumber ?? null,
    currentPlayer: leader,
    hands: parsePbnDeal(initialPbn),
    currentTrick: [] as Card[],
    trickLeader: leader,
    trickComplete: false,
    tricksNS: 0,
    tricksEW: 0,
    tricksAvailable: {} as Record<string, number>,
    evaluating: false,
    error: null as string | null,
    history: [] as BoardSnapshot[],
  };
}

const TRICK_PAUSE_MS = 900;

export function useBridgeGame(config?: BridgeGameConfig): BridgeGameState {
  const [state, setState] = useState(() => initFromConfig(config));

  const reset = useCallback((next?: BridgeGameConfig) => {
    setState(initFromConfig(next ?? config));
  }, [config]);

  const changeContract = useCallback(
    (level: number, trump: Trump, declarer: Seat) => {
      setState((prev) => {
        const leader = lho(declarer);
        return {
          ...prev,
          trump,
          declarer,
          contractLevel: level,
          contractLabel: formatContractLabel(level, trump, declarer),
          currentPlayer: leader,
          hands: parsePbnDeal(prev.initialPbn),
          currentTrick: [],
          trickLeader: leader,
          trickComplete: false,
          tricksNS: 0,
          tricksEW: 0,
          tricksAvailable: {},
          evaluating: false,
          error: null,
          history: [],
        };
      });
    },
    [],
  );

  const isLegal = useCallback(
    (suit: Suit, rank: Rank) => {
      const hand = state.hands[state.currentPlayer];
      const legal = legalCards(hand, state.currentTrick);
      return legal.some((c) => c.suit === suit && c.rank === rank);
    },
    [state.hands, state.currentPlayer, state.currentTrick],
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) return prev;
      const history = prev.history.slice(0, -1);
      const restored = prev.history[prev.history.length - 1];
      return {
        ...prev,
        ...restored,
        history,
        tricksAvailable: {},
        evaluating: false,
        error: null,
      };
    });
  }, []);

  const playCard = useCallback((suit: Suit, rank: Rank) => {
    setState((prev) => {
      if (prev.trickComplete) return prev;
      const card: Card = { suit, rank };
      const hand = prev.hands[prev.currentPlayer];
      const legal = legalCards(hand, prev.currentTrick);
      if (!legal.some((c) => sameCard(c, card))) {
        return { ...prev, error: `Illegal play: ${cardId(card)}` };
      }

      const history = [...prev.history, snapshotBoard(prev)];
      const newHands: Hands = {
        ...prev.hands,
        [prev.currentPlayer]: removeCard(hand, card),
      };
      const newTrick = [...prev.currentTrick, card];

      if (newTrick.length < 4) {
        return {
          ...prev,
          history,
          hands: newHands,
          currentTrick: newTrick,
          currentPlayer: nextSeat(prev.currentPlayer),
          error: null,
          tricksAvailable: {},
        };
      }

      // Hold the completed trick on the table briefly, then clear in an effect.
      return {
        ...prev,
        history,
        hands: newHands,
        currentTrick: newTrick,
        trickComplete: true,
        error: null,
        tricksAvailable: {},
      };
    });
  }, []);

  // After a completed trick is shown, award it and advance the lead.
  useEffect(() => {
    if (!state.trickComplete || state.currentTrick.length !== 4) return;
    const winner = trickWinner(state.currentTrick, state.trickLeader, state.trump);
    const nsWon = winner === "N" || winner === "S";
    const timer = window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        currentTrick: [],
        trickComplete: false,
        trickLeader: winner,
        currentPlayer: winner,
        tricksNS: prev.tricksNS + (nsWon ? 1 : 0),
        tricksEW: prev.tricksEW + (nsWon ? 0 : 1),
        tricksAvailable: {},
      }));
    }, TRICK_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [state.trickComplete, state.currentTrick, state.trickLeader, state.trump]);

  // Fetch double-dummy scores whenever the turn / board position changes.
  useEffect(() => {
    if (state.trickComplete) return;

    const cardsLeft =
      state.hands.N.length +
      state.hands.E.length +
      state.hands.S.length +
      state.hands.W.length;
    if (cardsLeft === 0) {
      setState((prev) => ({ ...prev, tricksAvailable: {}, evaluating: false }));
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, evaluating: true, error: null }));

    const payload = {
      pbn: handsToPbn(state.hands),
      // Hands in the PBN still contain cards that are in the current trick.
      // Rebuild PBN from hands + re-add trick cards into the deal? Actually
      // playCard already removed trick cards from hands. The backend Deal
      // needs remaining cards IN HANDS plus current_trick played onto the deal.
      // So we must put current-trick cards back into the seat that played them
      // for the PBN, OR send hands-as-remaining and current_trick separately.
      // Our backend expects remaining hands WITHOUT the trick cards already
      // removed, then plays current_trick — but those cards must still be in
      // the deal for deal.play() to work.
      // Fix: reconstruct hands with trick cards restored for the API call.
      trump: state.trump,
      declarer: state.declarer,
      current_trick: state.currentTrick.map(cardId),
      leader: state.trickLeader,
    };

    // Restore cards from the current trick into the appropriate seats for DDS.
    const restored: Hands = {
      N: [...state.hands.N],
      E: [...state.hands.E],
      S: [...state.hands.S],
      W: [...state.hands.W],
    };
    let seat = state.trickLeader;
    for (const card of state.currentTrick) {
      restored[seat] = [...restored[seat], card];
      seat = nextSeat(seat);
    }
    payload.pbn = handsToPbn(restored);

    fetch(`${API_BASE}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? res.statusText);
        }
        return res.json() as Promise<{ tricks: Record<string, number> }>;
      })
      .then((data) => {
        setState((prev) => ({
          ...prev,
          tricksAvailable: data.tricks,
          evaluating: false,
        }));
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          evaluating: false,
          error: err.message,
          tricksAvailable: {},
        }));
      });

    return () => controller.abort();
  }, [
    state.hands,
    state.currentTrick,
    state.trickLeader,
    state.trump,
    state.declarer,
    state.currentPlayer,
  ]);

  const { history, ...publicState } = state;

  return {
    ...publicState,
    canUndo: history.length > 0,
    playCard,
    undo,
    reset,
    changeContract,
    isLegal,
  };
}

export { parseCard, parsePbnDeal };
