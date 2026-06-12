import { describe, it, expect } from "vitest";
import { rankPeople, type PeopleCandidate } from "./match";

function cand(over: Partial<PeopleCandidate> & { user_id: string }): PeopleCandidate {
  return {
    user_id: over.user_id,
    name: over.name ?? `User ${over.user_id}`,
    photo_url: over.photo_url ?? null,
    interests: over.interests ?? [],
    city: over.city ?? null,
  };
}

const me = { interests: ["running", "coffee", "movies"], city: "Москва" };

describe("rankPeople", () => {
  it("excludes candidates with no shared interests", () => {
    const out = rankPeople(me, [cand({ user_id: "a", interests: ["chess"] })]);
    expect(out).toEqual([]);
  });

  it("ranks more shared interests higher", () => {
    const out = rankPeople(me, [
      cand({ user_id: "one", interests: ["running"] }),
      cand({ user_id: "two", interests: ["running", "coffee"] }),
    ]);
    expect(out.map((m) => m.candidate.user_id)).toEqual(["two", "one"]);
    expect(out[0].sharedInterests).toEqual(["running", "coffee"]);
  });

  it("same city breaks ties / boosts", () => {
    const out = rankPeople(me, [
      cand({ user_id: "far", interests: ["running"], city: "Питер" }),
      cand({ user_id: "near", interests: ["running"], city: "Москва" }),
    ]);
    expect(out[0].candidate.user_id).toBe("near");
    expect(out[0].sameCity).toBe(true);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 8 }, (_, i) => cand({ user_id: `u${i}`, interests: ["running"] }));
    expect(rankPeople(me, many, { limit: 3 })).toHaveLength(3);
  });

  it("empty when the viewer has no interests", () => {
    expect(rankPeople({ interests: [], city: "Москва" }, [cand({ user_id: "a", interests: ["running"] })])).toEqual([]);
  });
});
