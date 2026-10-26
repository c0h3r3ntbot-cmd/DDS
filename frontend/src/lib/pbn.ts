import { Seat, Trump } from "./bridge";

const TARGET_PLAYER = "Steve Cheng";

export interface ParsedContract {
  level: number;
  trump: Trump;
  declarer: Seat;
  /** e.g. "4♥ South" */
  label: string;
  /** Raw PBN contract string when present, else ParContract. */
  raw: string;
  doubled: boolean;
  redoubled: boolean;
}

export interface PbnBoard {
  board: number;
  deal: string;
  declarer: Seat;
  trump: Trump;
  contract: ParsedContract;
  steveSeat: Seat | null;
  players: Record<Seat, string>;
  rawTags: Record<string, string>;
}

export interface PbnSession {
  boards: PbnBoard[];
  playerFilter: string;
}

/** @deprecated single-game helper retained for simple samples */
export interface ParsedPbn {
  pbn: string;
  declarer: Seat;
  trump: Trump;
  contractLabel: string;
  rawTags: Record<string, string>;
}

const SEAT_RE = /^[NESW]$/i;
const SUIT_GLYPH: Record<Trump, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  NT: "NT",
};
const SEAT_NAME: Record<Seat, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
};

function parseSeat(value: string): Seat | null {
  const v = value.trim().toUpperCase();
  return SEAT_RE.test(v) ? (v as Seat) : null;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

/** Match "Steve Cheng", "Cheng, Steve", "Cheng Steve", etc. */
export function nameMatchesPlayer(name: string, target = TARGET_PLAYER): boolean {
  const n = normalizeName(name);
  if (!n) return false;
  const t = normalizeName(target);
  if (n === t) return true;
  const [first, ...rest] = t.split(" ");
  const last = rest.join(" ");
  if (!last) return n.includes(first);
  return (
    n === `${last} ${first}` ||
    n === `${last}, ${first}` ||
    (n.includes(first) && n.includes(last))
  );
}

function extractTags(gameText: string): Record<string, string> {
  const rawTags: Record<string, string> = {};
  const tagRe = /\[(\w+)\s+"([^"]*)"\]/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(gameText)) !== null) {
    // First occurrence wins for identification tags; later dupes rare in export
    if (!(match[1] in rawTags)) {
      rawTags[match[1]] = match[2];
    }
  }
  return rawTags;
}

/**
 * Split a PBN file into games. Per PBN 2.1, each game after the first starts
 * with a semi-empty (blank) line.
 */
export function splitPbnGames(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split(/\n[ \t]*\n+/);
  return chunks.map((c) => c.trim()).filter((c) => /\[\w+\s+"/.test(c));
}

function formatContractLabel(
  level: number,
  trump: Trump,
  declarer: Seat,
  doubled: boolean,
  redoubled: boolean,
): string {
  const strain = trump === "NT" ? "NT" : SUIT_GLYPH[trump];
  const risk = redoubled ? "XX" : doubled ? "X" : "";
  return `${level}${strain}${risk} ${SEAT_NAME[declarer]}`;
}

/**
 * Parse [Contract "4HX"] / "3NT" / "Pass".
 */
function parseContractTag(
  contract: string,
  declarerTag: string,
): ParsedContract | null {
  const c = contract.trim().toUpperCase();
  if (!c || c === "PASS") return null;
  const m = c.match(/^(\d+)(NT|[SHDC])(XX|X)?$/);
  if (!m) return null;
  const level = Number(m[1]);
  const trump: Trump = m[2] === "NT" ? "NT" : (m[2] as Trump);
  const redoubled = m[3] === "XX";
  const doubled = m[3] === "X";
  const declarer = parseSeat(declarerTag);
  if (!declarer) return null;
  return {
    level,
    trump,
    declarer,
    doubled,
    redoubled,
    raw: contract.trim(),
    label: formatContractLabel(level, trump, declarer, doubled, redoubled),
  };
}

/**
 * Parse [ParContract "NS 3N="] / "EW 4HX-1" / "S 3N+2".
 * Denomination uses N or NT for notrump in Common Game / BridgeComposer exports.
 */
function parseParContract(par: string): ParsedContract | null {
  // Multiple pars may be listed: "NS 4H=; NS 4S=" — use the first.
  const first = par.split(";")[0]?.trim() ?? "";
  const p = first.toUpperCase();
  const m = p.match(/^(NS|EW|[NESW])\s+(\d+)(NT|N|[SHDC])(XX|X)?([+-]\d+|=)?$/);
  if (!m) return null;
  const who = m[1];
  const level = Number(m[2]);
  const denom = m[3];
  const trump: Trump = denom === "NT" || denom === "N" ? "NT" : (denom as Trump);
  const redoubled = m[4] === "XX";
  const doubled = m[4] === "X";
  let declarer: Seat;
  if (who === "NS") declarer = "S";
  else if (who === "EW") declarer = "W";
  else declarer = who as Seat;
  return {
    level,
    trump,
    declarer,
    doubled,
    redoubled,
    raw: par.trim(),
    label: formatContractLabel(level, trump, declarer, doubled, redoubled),
  };
}

function playersFromTags(tags: Record<string, string>): Record<Seat, string> {
  return {
    N: tags.North ?? "",
    E: tags.East ?? "",
    S: tags.South ?? "",
    W: tags.West ?? "",
  };
}

function steveSeatFromPlayers(players: Record<Seat, string>): Seat | null {
  for (const seat of ["N", "E", "S", "W"] as Seat[]) {
    if (nameMatchesPlayer(players[seat])) return seat;
  }
  return null;
}

function resolveContract(tags: Record<string, string>): ParsedContract | null {
  const fromContract = parseContractTag(tags.Contract ?? "", tags.Declarer ?? "");
  if (fromContract) return fromContract;
  if (tags.ParContract) return parseParContract(tags.ParContract);
  if (tags.Trump) {
    const declarer = parseSeat(tags.Declarer ?? "") ?? "S";
    const trumpRaw = tags.Trump.trim().toUpperCase();
    let trump: Trump;
    if (trumpRaw === "NT" || trumpRaw === "N") trump = "NT";
    else if ("SHDC".includes(trumpRaw[0])) trump = trumpRaw[0] as Trump;
    else return null;
    const level = 1;
    return {
      level,
      trump,
      declarer,
      doubled: false,
      redoubled: false,
      raw: tags.Trump,
      label: formatContractLabel(level, trump, declarer, false, false),
    };
  }
  return null;
}

function parseGame(gameText: string): PbnBoard | null {
  const tags = extractTags(gameText);
  const deal = tags.Deal?.trim();
  if (!deal) return null;
  const boardNum = Number(tags.Board);
  if (!Number.isFinite(boardNum)) return null;

  const contract = resolveContract(tags);
  if (!contract) return null;

  const players = playersFromTags(tags);
  return {
    board: boardNum,
    deal,
    declarer: contract.declarer,
    trump: contract.trump,
    contract,
    steveSeat: steveSeatFromPlayers(players),
    players,
    rawTags: tags,
  };
}

/**
 * Parse a full PBN file and return boards that Steve Cheng played,
 * sorted by board number ascending.
 */
export function parsePbnSession(
  text: string,
  playerName = TARGET_PLAYER,
): PbnSession {
  const games = splitPbnGames(text);
  const allBoards: PbnBoard[] = [];
  for (const game of games) {
    const board = parseGame(game);
    if (board) allBoards.push(board);
  }

  const anyNamed = allBoards.some((b) =>
    (["N", "E", "S", "W"] as Seat[]).some((s) => b.players[s].trim() !== ""),
  );

  let boards: PbnBoard[];
  if (anyNamed) {
    boards = allBoards.filter((b) =>
      (["N", "E", "S", "W"] as Seat[]).some((s) =>
        nameMatchesPlayer(b.players[s], playerName),
      ),
    );
  } else {
    // Anonymous hand-record export: cannot filter by player.
    boards = allBoards;
  }

  boards.sort((a, b) => a.board - b.board);
  return { boards, playerFilter: playerName };
}

export function boardToGameConfig(board: PbnBoard) {
  return {
    pbn: board.deal,
    trump: board.trump,
    declarer: board.declarer,
    contractLevel: board.contract.level,
    contractLabel: board.contract.label,
    boardNumber: board.board,
  };
}

/**
 * Parse PBN text: single-game or first matching board (legacy helper).
 */
export function parsePbnFile(text: string): ParsedPbn {
  const session = parsePbnSession(text);
  if (session.boards.length === 0) {
    throw new Error(
      `No boards found for ${TARGET_PLAYER} (need Deal + Contract or ParContract)`,
    );
  }
  const board = session.boards[0];
  return {
    pbn: board.deal,
    declarer: board.declarer,
    trump: board.trump,
    contractLabel: board.contract.label,
    rawTags: board.rawTags,
  };
}
