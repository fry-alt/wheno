import { afterEach, describe, expect, it } from "vitest";
import {
  escapeHtml,
  friendRequestMsg,
  friendAcceptedMsg,
  meetingProposedMsg,
  meetingAcceptedMsg,
  meetingConfirmedMsg,
  openButton,
} from "./notify";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("escapeHtml", () => {
  it("neutralizes &, <, >", () => {
    expect(escapeHtml('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; "d"');
  });
});

describe("message builders", () => {
  it("builds the five messages with interpolation", () => {
    expect(friendRequestMsg("Аня")).toBe("👋 <b>Аня</b> хочет добавить вас в друзья");
    expect(friendAcceptedMsg("Аня")).toBe("✅ <b>Аня</b> принял ваш запрос в друзья");
    expect(meetingProposedMsg("Аня", "Кофе")).toBe("📅 <b>Аня</b> предлагает встречу: «Кофе»");
    expect(meetingAcceptedMsg("Аня", "Кофе")).toBe("✅ <b>Аня</b> принял встречу «Кофе» — выберите время");
    expect(meetingConfirmedMsg("Аня", "Кофе", "ср, 11 июня, 14:00")).toBe("🤝 «Кофе» с Аня — ср, 11 июня, 14:00");
  });

  it("escapes HTML-unsafe names and titles", () => {
    expect(friendRequestMsg("<b>x</b>")).toBe("👋 <b>&lt;b&gt;x&lt;/b&gt;</b> хочет добавить вас в друзья");
    expect(meetingProposedMsg("A&B", "1<2")).toBe("📅 <b>A&amp;B</b> предлагает встречу: «1&lt;2»");
  });
});

describe("openButton", () => {
  it("returns a web_app keyboard for an https APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wheno.vercel.app";
    expect(openButton()).toEqual({
      inline_keyboard: [[{ text: "Открыть", web_app: { url: "https://wheno.vercel.app/friends" } }]],
    });
  });

  it("returns undefined for a non-https APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(openButton()).toBeUndefined();
  });
});
