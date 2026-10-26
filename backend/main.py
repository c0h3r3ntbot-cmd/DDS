"""
Bridge Double Dummy Solver API.

Exposes /api/evaluate which uses endplay (Bo Haglund's DDS) to return
the number of tricks available for each legal card the next player can play.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from endplay.dds import solve_board
from endplay.types import Deal, Denom, Player

app = FastAPI(title="Bridge Double Dummy Solver", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- helpers -----------------------------------------------------------------

PLAYER_ALIASES = {
    "n": Player.north,
    "north": Player.north,
    "e": Player.east,
    "east": Player.east,
    "s": Player.south,
    "south": Player.south,
    "w": Player.west,
    "west": Player.west,
}

TRUMP_ALIASES = {
    "s": Denom.spades,
    "spades": Denom.spades,
    "♠": Denom.spades,
    "h": Denom.hearts,
    "hearts": Denom.hearts,
    "♥": Denom.hearts,
    "d": Denom.diamonds,
    "diamonds": Denom.diamonds,
    "♦": Denom.diamonds,
    "c": Denom.clubs,
    "clubs": Denom.clubs,
    "♣": Denom.clubs,
    "n": Denom.nt,
    "nt": Denom.nt,
    "notrump": Denom.nt,
    "no-trump": Denom.nt,
    "no trump": Denom.nt,
}


def parse_player(value: str) -> Player:
    key = value.strip().lower()
    if key not in PLAYER_ALIASES:
        raise ValueError(f"Invalid player: {value!r}. Use N/E/S/W.")
    return PLAYER_ALIASES[key]


def parse_trump(value: str) -> Denom:
    key = value.strip().lower()
    if key not in TRUMP_ALIASES:
        raise ValueError(f"Invalid trump: {value!r}. Use S/H/D/C/NT.")
    return TRUMP_ALIASES[key]


def normalize_card(card: str) -> str:
    """Accept 'SA', 'S A', '♠A', etc. and return endplay-friendly 'SA'."""
    s = card.strip().upper().replace(" ", "")
    suit_map = {"♠": "S", "♥": "H", "♦": "D", "♣": "C"}
    for sym, letter in suit_map.items():
        s = s.replace(sym, letter)
    if len(s) < 2:
        raise ValueError(f"Invalid card: {card!r}")
    # Allow rank-then-suit (AS) by swapping if needed
    if s[0] in "AKQJT98765432" and s[1] in "SHDC":
        s = s[1] + s[0]
    if s[0] not in "SHDC" or s[1:] not in {
        "A", "K", "Q", "J", "T", "10", "9", "8", "7", "6", "5", "4", "3", "2",
    }:
        raise ValueError(f"Invalid card: {card!r}")
    rank = "T" if s[1:] == "10" else s[1:]
    return s[0] + rank


def card_key(card) -> str:
    """Stable API key for a card, e.g. 'SA', 'HT'."""
    suit_letter = {"spades": "S", "hearts": "H", "diamonds": "D", "clubs": "C"}
    return suit_letter[card.suit.name] + card.rank.abbr


def hands_to_pbn(hands: Dict[str, List[str]]) -> str:
    """
    Convert {"N": ["SA","SK",...], ...} into a PBN deal string starting at North.
    Suit order in each hand: S H D C.
    """
    order = ["N", "E", "S", "W"]
    aliases = {
        "n": "N", "north": "N",
        "e": "E", "east": "E",
        "s": "S", "south": "S",
        "w": "W", "west": "W",
    }
    normalized: Dict[str, List[str]] = {}
    for key, cards in hands.items():
        seat = aliases.get(key.strip().lower())
        if seat is None:
            raise ValueError(f"Invalid seat in hands: {key!r}")
        normalized[seat] = [normalize_card(c) for c in cards]

    missing = [s for s in order if s not in normalized]
    if missing:
        raise ValueError(f"hands missing seats: {missing}")

    parts = []
    for seat in order:
        by_suit: Dict[str, List[str]] = {"S": [], "H": [], "D": [], "C": []}
        for c in normalized[seat]:
            by_suit[c[0]].append(c[1:])
        # Preserve relative rank order as given; DDS does not care about order
        parts.append(".".join("".join(by_suit[s]) for s in "SHDC"))
    return "N:" + " ".join(parts)


# --- request / response models -----------------------------------------------

class EvaluateRequest(BaseModel):
    """Payload for double-dummy evaluation of the next player's legal cards."""

    pbn: Optional[str] = Field(
        None,
        description="Remaining cards as a PBN deal string, e.g. 'N:AK.. .. .. ..'",
    )
    hands: Optional[Dict[str, List[str]]] = Field(
        None,
        description='Remaining cards per seat, e.g. {"N": ["SA","HK"], ...}',
    )
    trump: str = Field(..., description="Trump suit: S/H/D/C/NT")
    declarer: str = Field(..., description="Declarer: N/E/S/W")
    current_trick: List[str] = Field(
        default_factory=list,
        description="Cards already played in the current trick, in play order",
    )
    leader: Optional[str] = Field(
        None,
        description=(
            "Player who led (or will lead) the current trick. "
            "Defaults to declarer's LHO (opening-lead seat)."
        ),
    )

    @model_validator(mode="after")
    def require_deal_source(self) -> "EvaluateRequest":
        if not self.pbn and not self.hands:
            raise ValueError("Provide either 'pbn' or 'hands'")
        return self


class EvaluateResponse(BaseModel):
    next_player: str
    tricks: Dict[str, int] = Field(
        ...,
        description="Map of legal card (e.g. 'SA') -> tricks that player's side can make",
    )


# --- routes ------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest) -> EvaluateResponse:
    try:
        trump = parse_trump(req.trump)
        declarer = parse_player(req.declarer)
        leader = parse_player(req.leader) if req.leader else declarer.lho
        trick_cards = [normalize_card(c) for c in req.current_trick]

        pbn = req.pbn if req.pbn else hands_to_pbn(req.hands)  # type: ignore[arg-type]
        deal = Deal(pbn, first=leader, trump=trump)

        for card in trick_cards:
            deal.play(card)

        solved = solve_board(deal)
        tricks: Dict[str, int] = {}
        for card, n in solved:
            tricks[card_key(card)] = int(n)

        next_player = deal.curplayer.name[0].upper()  # 'north' -> 'N'
        return EvaluateResponse(next_player=next_player, tricks=tricks)

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - unexpected DDS/input failures
        raise HTTPException(status_code=500, detail=str(exc)) from exc
