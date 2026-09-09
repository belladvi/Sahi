/**
 * whatYouNeedData.ts — the document set + reason phrase for the
 * "What you'll need" screen, derived from the user's premises (from qualify
 * step 2). Keeps the screen data-driven: owners need 3 documents, renters
 * (and "somewhere else") need 4 — the extra one being address proof.
 */

import type { NeededDoc } from "./WhatYouNeedStepRented";

export type Premises = "own" | "rent" | "other";

const BASE_DOCS: NeededDoc[] = [
  { label: "Passport-size photo" },
  { label: "Aadhaar", desc: "Identity proof" },
  {
    label: "PAN",
    desc: "Business identity",
    note: "PAN counts as your business identity, as required by the food authority.",
  },
];

const ADDRESS_PROOF: NeededDoc = {
  label: "Address proof",
  desc: "Bill or rent agreement",
  note: "A recent utility bill or your rent agreement works.",
};

/** Renters (and "somewhere else") need address proof; owners don't. */
export function documentsFor(premises: Premises): NeededDoc[] {
  return premises === "own" ? BASE_DOCS : [...BASE_DOCS, ADDRESS_PROOF];
}

/** Personalized reason phrase used in the intro sentence. */
export function reasonFor(premises: Premises): string {
  switch (premises) {
    case "own":
      return "own your kitchen";
    case "rent":
      return "rent your kitchen";
    default:
      return "cook somewhere else";
  }
}
