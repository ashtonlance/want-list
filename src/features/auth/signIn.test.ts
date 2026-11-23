import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/supabase", () => ({ SUPABASE_URL: "https://x.supabase.co", supabase: {} }));

const { codeDigits, findLink, isWholeCode, readPendingSignIn } = await import("./signIn");

describe("codeDigits", () => {
  it("keeps only digits, up to the longest code Supabase sends", () => {
    expect(codeDigits("123 456")).toBe("123456");
    expect(codeDigits("12345678901234")).toBe("1234567890");
  });
});

describe("findLink", () => {
  it("finds the link anywhere in pasted text", () => {
    expect(findLink("Sign in: https://x.supabase.co/auth/v1/verify?token=8f3a91&type=magiclink")).toBe(
      "https://x.supabase.co/auth/v1/verify?token=8f3a91&type=magiclink",
    );
    expect(findLink("123456")).toBeNull();
  });
  it("leaves out brackets, quotes and closing punctuation", () => {
    const url = "https://x.supabase.co/auth/v1/verify?token=abc&type=magiclink";
    expect(findLink(`Sign in (${url}).`)).toBe(url);
    expect(findLink(`<${url}>`)).toBe(url);
    expect(findLink(`"${url}",`)).toBe(url);
  });
});

describe("isWholeCode", () => {
  it("accepts 6 to 10 digits with spaces or dashes", () => {
    expect(isWholeCode("123-456")).toBe(true);
    expect(isWholeCode("12345678")).toBe(true);
    expect(isWholeCode("12345")).toBe(false);
  });
  it("never treats text with letters as a code", () => {
    expect(isWholeCode("token 8f3a91123456")).toBe(false);
  });
});

describe("readPendingSignIn", () => {
  const now = 1_000_000_000;
  it("reopens on an email a code went to in the last hour", () => {
    expect(readPendingSignIn(JSON.stringify({ email: "a@b.co", at: now - 60_000 }), now)).toBe("a@b.co");
  });
  it("forgets it after an hour, or when the saved copy is damaged", () => {
    expect(readPendingSignIn(JSON.stringify({ email: "a@b.co", at: now - 61 * 60_000 }), now)).toBeNull();
    expect(readPendingSignIn("{nope", now)).toBeNull();
    expect(readPendingSignIn(JSON.stringify({ email: 5, at: now }), now)).toBeNull();
    expect(readPendingSignIn(null, now)).toBeNull();
  });
});
