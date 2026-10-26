/** Shared bridge types and pure helpers. */

export type Seat = "N" | "E" | "S" | "W";
export type Suit = "S" | "H" | "D" | "C";
export type Trump = Suit | "NT";
export type Rank = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Hands = Record<Seat, Card[]>;

export const SEATS: Seat[] = ["N", "E", "S", "W"];
export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANK_ORDER: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];

export function cardId(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function parseCard(raw: string): Card {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const suitMap: Record<string, Suit> = {
    S: "S", H: "H", D: "D", C: "C",
    "♠": "S", "♥": "H", "♦": "D", "♣": "C",
  };
  let suitChar = s[0];
  let rankChar = s.slice(1);
  if (rankChar === "10") rankChar = "T";
  // Allow rank-then-suit (AS)
  if (!(suitChar in suitMap) && s[1] && suitMap[s[1]]) {
    rankChar = s[0] === "1" && s[1] === "0" ? "T" : s[0];
    suitChar = s[s[0] === "1" ? 2 : 1];
  }
  const suit = suitMap[suitChar];
  if (!suit || !RANK_ORDER.includes(rankChar as Rank)) {
    throw new Error(`Invalid card: ${raw}`);
  }
  return { suit, rank: rankChar as Rank };
}

export function nextSeat(seat: Seat): Seat {
  const i = SEATS.indexOf(seat);
  return SEATS[(i + 1) % 4];
}

/** Left-hand opponent of declarer (opening leader). */
export function lho(declarer: Seat): Seat {
  return nextSeat(declarer);
}

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** Winner of a completed trick (exactly 4 cards), given who led and trump. */
export function trickWinner(
  trick: Card[],
  leader: Seat,
  trump: Trump,
): Seat {
  if (trick.length !== 4) {
    throw new Error("trickWinner requires 4 cards");
  }
  const led = trick[0].suit;
  let bestIdx = 0;
  for (let i = 1; i < 4; i++) {
    const card = trick[i];
    const best = trick[bestIdx];
    const cardTrump = trump !== "NT" && card.suit === trump;
    const bestTrump = trump !== "NT" && best.suit === trump;
    if (cardTrump && !bestTrump) {
      bestIdx = i;
    } else if (cardTrump === bestTrump) {
      const sameLed = card.suit === led && best.suit === led;
      const bothTrump = cardTrump && bestTrump;
      if ((sameLed || bothTrump) && rankValue(card.rank) > rankValue(best.rank)) {
        bestIdx = i;
      }
    }
  }
  let seat = leader;
  for (let i = 0; i < bestIdx; i++) seat = nextSeat(seat);
  return seat;
}

/**
 * Parse a PBN Deal tag value into hands.
 * Accepts forms like `N:AK93.J62... ...` or without the `N:` prefix
 * (then cards are assumed to start at North in NESW order).
 */
export function parsePbnDeal(deal: string): Hands {
  let body = deal.trim();
  let start: Seat = "N";
  const m = body.match(/^([NESW]):\s*(.*)$/i);
  if (m) {
    start = m[1].toUpperCase() as Seat;
    body = m[2];
  }
  const handStrs = body.split(/\s+/).filter(Boolean);
  if (handStrs.length !== 4) {
    throw new Error(`PBN deal must have 4 hands, got ${handStrs.length}`);
  }

  const hands: Hands = { N: [], E: [], S: [], W: [] };
  let seat = start;
  for (const handStr of handStrs) {
    const suits = handStr.split(".");
    if (suits.length !== 4) {
      throw new Error(`Hand ${seat} must have 4 suit groups: ${handStr}`);
    }
    SUITS.forEach((suit, i) => {
      for (const ch of suits[i]) {
        const rank = (ch === "1" ? null : ch) as Rank | null; // ignore lone 1 from 10 if any
        if (!rank) continue;
        const r = ch === "X" ? null : (ch as Rank);
        if (r && RANK_ORDER.includes(r)) {
          hands[seat].push({ suit, rank: r });
        }
      }
    });
    seat = nextSeat(seat);
  }
  return hands;
}

/** Encode remaining hands back to a PBN string starting at North. */
export function handsToPbn(hands: Hands): string {
  const parts = SEATS.map((seat) => {
    const bySuit: Record<Suit, string> = { S: "", H: "", D: "", C: "" };
    for (const c of hands[seat]) {
      bySuit[c.suit] += c.rank;
    }
    return SUITS.map((s) => bySuit[s]).join(".");
  });
  return `N:${parts.join(" ")}`;
}

/** Legal cards for `player` given cards already in the current trick. */
export function legalCards(hand: Card[], currentTrick: Card[]): Card[] {
  if (currentTrick.length === 0) return [...hand];
  const led = currentTrick[0].suit;
  const follow = hand.filter((c) => c.suit === led);
  return follow.length > 0 ? follow : [...hand];
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function removeCard(hand: Card[], card: Card): Card[] {
  const idx = hand.findIndex((c) => sameCard(c, card));
  if (idx < 0) throw new Error(`Card ${cardId(card)} not in hand`);
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}
