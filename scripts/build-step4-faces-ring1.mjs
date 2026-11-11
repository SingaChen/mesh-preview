/**
 * Writes the official Bunny bed: every ring of faces_ring_layout.json,
 * the same sheet as build-step4-faces-ring0.mjs.
 *
 *   node scripts/build-step4-faces-ring1.mjs
 */

import { emitOfficialBunnyBed } from "./build-step4-faces-ring0.mjs";

emitOfficialBunnyBed(false);
