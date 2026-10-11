/**
 * Shareable build links: the builder state is serialized into the URL hash
 * (#b=...) so builds can be bookmarked and shared without any server.
 *
 * Encoding is versioned and lossy-tolerant on decode: unknown piece, charm
 * or decoration ids (e.g. after a dataset update) are dropped and reported
 * back as warnings instead of breaking the link.
 */
import type { BuildState } from './build';
import { armorById, charmById, decoById } from '../data/lookup';
import type { PieceKind } from '../data/types';

const VERSION = 1;
const KINDS: PieceKind[] = ['head', 'chest', 'arms', 'waist', 'legs'];

interface WireState {
  v: number;
  /** [head, chest, arms, waist, legs] piece ids, 0 = empty. */
  p: number[];
  /** Charm rank id, 0 = none. */
  c: number;
  /** Flat list of [pieceId, slotIndex, decoId]. */
  d: [number, number, number][];
}

export function encodeBuild(state: BuildState): string {
  const wire: WireState = {
    v: VERSION,
    p: KINDS.map((k) => state.pieces[k] ?? 0),
    c: state.charmId ?? 0,
    d: [],
  };
  for (const [pieceKey, slots] of Object.entries(state.decos)) {
    slots.forEach((decoId, slotIndex) => {
      if (decoId !== null && decoId !== undefined) wire.d.push([Number(pieceKey), slotIndex, decoId]);
    });
  }
  const json = JSON.stringify(wire);
  const b64 = base64UrlEncode(json);
  return `b=${b64}`;
}

export function decodeBuild(hash: string): { state: BuildState; warnings: string[] } {
  const warnings: string[] = [];
  const state: BuildState = { pieces: {}, decos: {} };
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const payload = params.get('b');
  if (!payload) return { state, warnings };

  let wire: WireState | null = null;
  try {
    wire = JSON.parse(base64UrlDecode(payload)) as WireState;
  } catch {
    return { state, warnings: ['The shared link is malformed and could not be read.'] };
  }
  if (!wire || typeof wire !== 'object' || wire.v !== VERSION) {
    return { state, warnings: ['The shared link uses an unknown format version.'] };
  }

  KINDS.forEach((kind, i) => {
    const id = wire.p?.[i];
    if (!id) return;
    if (armorById.has(id)) state.pieces[kind] = id;
    else warnings.push(`Shared link referenced armor piece #${id}, which is not in the current dataset - skipped.`);
  });

  if (wire.c) {
    if (charmById.has(wire.c)) state.charmId = wire.c;
    else warnings.push(`Shared link referenced charm #${wire.c}, which is not in the current dataset - skipped.`);
  }

  for (const [pieceId, slotIndex, decoId] of wire.d ?? []) {
    const piece = armorById.get(pieceId);
    const deco = decoById.get(decoId);
    if (!piece) {
      warnings.push(`Shared link referenced armor piece #${pieceId}, which is not in the current dataset - its decoration was skipped.`);
      continue;
    }
    if (!piece.slots[slotIndex]) {
      warnings.push(`Shared link set a decoration in slot ${slotIndex + 1} of ${piece.name}, which has ${piece.slots.length} slots - skipped.`);
      continue;
    }
    if (!deco) {
      warnings.push(`Shared link referenced decoration #${decoId}, which is not in the current dataset - skipped.`);
      continue;
    }
    const list = (state.decos[pieceId] ??= Array<number | null>(piece.slots.length).fill(null));
    if (slotIndex < list.length) list[slotIndex] = decoId;
  }

  return { state, warnings };
}

/** Prune deco assignments for pieces that are no longer equipped (keeps state clean before encode). */
export function pruneOrphanDecos(state: BuildState): BuildState {
  const equipped = new Set(Object.values(state.pieces).filter((v): v is number => v !== undefined));
  const decos: BuildState['decos'] = {};
  for (const [key, slots] of Object.entries(state.decos)) {
    if (!equipped.has(Number(key))) continue;
    decos[Number(key)] = slots;
  }
  return { ...state, decos };
}

// --- base64url (works in browsers and Node 18+ via Uint8Array) -------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function base64UrlDecode(text: string): string {
  return new TextDecoder().decode(base64UrlToBytes(text));
}
