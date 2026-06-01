import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  isSameMonth,
  startOfMonth,
  subDays,
} from "date-fns";

export interface GridDay {
  date: Date;
  inMonth: boolean;
}

/** Monday-first calendar grid padded to full weeks. */
export function buildMonthGrid(monthDate: Date): GridDay[] {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const leading = (getDay(first) + 6) % 7; // Mon=0 … Sun=6
  const lastIdx = (getDay(last) + 6) % 7;
  const trailing = lastIdx === 6 ? 0 : 6 - lastIdx;
  return eachDayOfInterval({
    start: subDays(first, leading),
    end: addDays(last, trailing),
  }).map((date) => ({ date, inMonth: isSameMonth(date, monthDate) }));
}
