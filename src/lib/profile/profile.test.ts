import { describe, it, expect } from "vitest";
import { ageFromBirthdate, publicProfileProjection, canAddPhoto, PHOTO_LIMIT } from "./profile";
import type { ProfileWithPhotos } from "./types";

const base: ProfileWithPhotos = {
  user_id: "u1", bio: "hi", city: "Москва", birthdate: "2000-06-15", gender: "male",
  show_age: true, show_gender: true, interests: ["tennis"], photos: [{ id: "p1", url: "x", position: 0 }],
};

describe("ageFromBirthdate", () => {
  it("computes age, accounting for birthday not yet reached", () => {
    expect(ageFromBirthdate("2000-06-15", "2026-06-15")).toBe(26);
    expect(ageFromBirthdate("2000-06-15", "2026-06-14")).toBe(25);
  });
});

describe("publicProfileProjection", () => {
  it("exposes age when show_age and birthdate set", () => {
    expect(publicProfileProjection(base, "2026-06-15").age).toBe(26);
  });
  it("hides age when show_age false; never leaks birthdate", () => {
    const p = publicProfileProjection({ ...base, show_age: false }, "2026-06-15");
    expect(p.age).toBeNull();
    expect("birthdate" in p).toBe(false);
  });
  it("age null when no birthdate", () => {
    expect(publicProfileProjection({ ...base, birthdate: null }, "2026-06-15").age).toBeNull();
  });
  it("hides gender when show_gender false", () => {
    expect(publicProfileProjection({ ...base, show_gender: false }, "2026-06-15").gender).toBeNull();
  });
  it("passes through bio/city/interests/photos", () => {
    const p = publicProfileProjection(base, "2026-06-15");
    expect(p).toMatchObject({ bio: "hi", city: "Москва", interests: ["tennis"] });
    expect(p.photos).toHaveLength(1);
  });
});

describe("canAddPhoto", () => {
  it("allows below the limit, blocks at it", () => {
    expect(canAddPhoto(0)).toBe(true);
    expect(canAddPhoto(PHOTO_LIMIT - 1)).toBe(true);
    expect(canAddPhoto(PHOTO_LIMIT)).toBe(false);
  });
});
