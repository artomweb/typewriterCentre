import { describe, expect, it } from "vitest";
import { findBestSplit, greedyWrap, diagnoseFailure } from "./centring.js";

describe("findBestSplit", () => {
  it("returns no lines for an empty title", () => {
    expect(findBestSplit("", 20, 10)).toEqual([]);
    expect(findBestSplit("   ", 20, 10)).toEqual([]);
  });

  it("keeps a title on one line when it fits and has the right parity", () => {
    expect(findBestSplit("Hello", 11, 11)).toEqual(["Hello"]);
  });

  it("ignores leading, trailing and repeated whitespace", () => {
    expect(findBestSplit("  ab   cd  ", 11, 11)).toEqual(["ab cd"]);
  });

  it("returns null when a line can never match the page parity", () => {
    expect(findBestSplit("Hi", 11, 11)).toBeNull();
    expect(findBestSplit("one two three", 20, 9)).toBeNull();
  });

  it("returns null when a word is longer than the max title width", () => {
    expect(findBestSplit("typewriter", 20, 5)).toBeNull();
  });

  it("finds a split that greedy wrapping misses", () => {
    // Greedy puts "a ab ab" (odd) on one line, which can't be centred on an even page
    expect(greedyWrap("a ab ab a", 7)).toEqual(["a ab ab", "a"]);
    expect(findBestSplit("a ab ab a", 20, 7)).toEqual(["a ab", "ab a"]);
  });

  it("keeps a title on one line rather than splitting it to fix parity", () => {
    expect(findBestSplit("Judith Kerr", 100, 20)).toBeNull();
    expect(findBestSplit("ab cd ef", 20, 5)).toBeNull();
  });

  it("prefers balanced lines", () => {
    // [7, 5] costs 14² + 16² = 452, beating [3, 9] at 468 and [3, 3, 5] at 904
    expect(findBestSplit("one two three", 21, 9)).toEqual(["one two", "three"]);
  });

  it("only returns lines that fit and can be centred with whole spaces", () => {
    const titles = [
      "The quick brown fox jumps over the lazy dog",
      "A tool for centring titles on a typewriter",
      "Breaking Paragraphs into Lines",
      "I like to centre titles on a typewriter but it is often tricky",
    ];
    for (const title of titles) {
      for (let pageWidth = 20; pageWidth <= 80; pageWidth++) {
        for (let maxTitleWidth = 10; maxTitleWidth <= pageWidth; maxTitleWidth += 3) {
          const lines = findBestSplit(title, pageWidth, maxTitleWidth);
          if (lines === null) continue;
          expect(lines.join(" ")).toBe(title);
          for (const line of lines) {
            expect(line.length).toBeLessThanOrEqual(maxTitleWidth);
            expect((pageWidth - line.length) % 2).toBe(0);
          }
        }
      }
    }
  });
});

describe("greedyWrap", () => {
  it("packs as many words as fit on each line", () => {
    expect(greedyWrap("one two three four", 9)).toEqual(["one two", "three", "four"]);
  });

  it("ignores repeated whitespace", () => {
    expect(greedyWrap("one   two", 20)).toEqual(["one two"]);
  });

  it("gives an over-long word its own line", () => {
    expect(greedyWrap("a typewriter b", 5)).toEqual(["a", "typewriter", "b"]);
  });
});

describe("diagnoseFailure", () => {
  it("returns null for an empty title", () => {
    expect(diagnoseFailure("  ", 20, 10)).toBeNull();
  });

  it("reports a title that can't be centred with any margin", () => {
    expect(diagnoseFailure("Hi", 11, 11)).toEqual({
      reason: "no-parity-split",
      message: "Cannot be centred",
      suggestedMaxTitleWidth: null,
    });
  });

  it("suggests a margin wide enough for a long word", () => {
    expect(diagnoseFailure("abcde", 11, 3)).toEqual({
      reason: "word-too-long-fixable",
      message: "Cannot be centred due to margin",
      suggestedMaxTitleWidth: 5,
    });
  });

  it("suggests the nearest margin that fixes parity", () => {
    expect(diagnoseFailure("ab cd", 11, 4)).toEqual({
      reason: "no-parity-split-fixable",
      message: "Cannot be centred due to margin",
      suggestedMaxTitleWidth: 5,
    });
  });
});

