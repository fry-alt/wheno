export interface PeopleCandidate {
  user_id: string;
  name: string;
  photo_url: string | null;
  interests: string[];
  city: string | null;
}

export interface PeopleMatch {
  candidate: PeopleCandidate;
  score: number;
  sharedInterests: string[];
  sameCity: boolean;
}

function normCity(c: string | null): string {
  return (c ?? "").trim().toLowerCase();
}

/**
 * Rank candidates by shared interests (primary) with a same-city bonus.
 * Pure — requires ≥1 shared interest to surface. Privacy-safe: no free/busy.
 */
export function rankPeople(
  me: { interests: string[]; city: string | null },
  candidates: PeopleCandidate[],
  opts: { limit?: number } = {},
): PeopleMatch[] {
  const limit = opts.limit ?? 10;
  if (me.interests.length === 0) return [];
  const mine = new Set(me.interests);
  const myCity = normCity(me.city);

  const matches: PeopleMatch[] = [];
  for (const c of candidates) {
    const sharedInterests = c.interests.filter((i) => mine.has(i));
    if (sharedInterests.length === 0) continue;
    const sameCity = myCity !== "" && normCity(c.city) === myCity;
    const score = sharedInterests.length * 10 + (sameCity ? 5 : 0);
    matches.push({ candidate: c, score, sharedInterests, sameCity });
  }

  matches.sort((a, b) => b.score - a.score || b.sharedInterests.length - a.sharedInterests.length);
  return matches.slice(0, limit);
}
