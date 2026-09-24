// Standard Naija Whot deck (54 cards) and pure rule helpers for whot.service.ts.
// Kept dependency-free / side-effect-free so the legality + turn-advance logic
// can be unit tested in isolation if desired.

export const WHOT_SHAPES = ['circle', 'triangle', 'cross', 'square', 'star'] as const;
export type WhotShape = (typeof WHOT_SHAPES)[number];

/** Card code convention: "<shape>-<number>", wild cards are "whot-20". */
export type WhotCard = string;

interface ShapeNumbers {
  shape: WhotShape;
  numbers: number[];
}

// Exact composition specified for the standard Nigerian Whot deck (54 cards).
const DECK_COMPOSITION: ShapeNumbers[] = [
  { shape: 'circle', numbers: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14] }, // 12
  { shape: 'triangle', numbers: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14] }, // 12
  { shape: 'cross', numbers: [1, 2, 3, 5, 7, 10, 11, 13, 14] }, // 9
  { shape: 'square', numbers: [1, 2, 3, 5, 7, 10, 11, 13, 14] }, // 9
  { shape: 'star', numbers: [1, 2, 3, 4, 5, 7, 8] }, // 7
];
const WHOT_WILD_COUNT = 5;

export function buildStandardDeck(): WhotCard[] {
  const deck: WhotCard[] = [];
  for (const { shape, numbers } of DECK_COMPOSITION) {
    for (const n of numbers) {
      deck.push(`${shape}-${n}`);
    }
  }
  for (let i = 0; i < WHOT_WILD_COUNT; i++) {
    deck.push('whot-20');
  }
  return deck; // 54 cards
}

/** Fisher-Yates shuffle. Math.random is fine here — not a casino-license product,
 * but genuinely random and never predictable from client-visible state since
 * this only ever runs server-side. */
export function shuffleDeck<T>(cards: T[]): T[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface ParsedCard {
  shape: string; // 'whot' for wild cards
  number: number;
  isWild: boolean;
}

export function parseCard(card: WhotCard): ParsedCard {
  const [shape, numStr] = card.split('-');
  const number = parseInt(numStr, 10);
  return { shape, number, isWild: shape === 'whot' };
}

export function isPickCard(number: number): boolean {
  return number === 2;
}

/** How many cards a Pick card forces the next player to draw. */
export function pickAmount(number: number): number {
  if (number === 2) return 2;
  return 0;
}

export interface LegalPlayContext {
  card: WhotCard;
  topCard: WhotCard;
  requestedShape: string | null;
  pendingPickCount: number;
}

/**
 * Server-authoritative legality check for playing `card` on top of `topCard`.
 * - While a pendingPickCount is owed, only another Pick card (2 or 5) may be
 *   played (stacking) — everything else must draw instead.
 * - Otherwise: shape or number match against the top card, a match against a
 *   still-open `requestedShape` (set by a prior Whot-20), or any Whot-20.
 */
export function isLegalPlay({ card, topCard, requestedShape, pendingPickCount }: LegalPlayContext): boolean {
  const played = parseCard(card);

  if (pendingPickCount > 0) {
    // Must counter with another Pick card (any shape) or draw instead.
    return isPickCard(played.number);
  }

  if (played.isWild) return true; // Whot-20 is always playable

  const top = parseCard(topCard);

  if (requestedShape) {
    return played.shape === requestedShape;
  }

  return played.shape === top.shape || played.number === top.number;
}
