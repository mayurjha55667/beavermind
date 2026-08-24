import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { parseTranscript } from "@/lib/transcript/parser";
import { fixture } from "../helpers";

describe("transcript parsing and numbering", () => {
  it("normalizes line endings and assigns stable one-based turn numbers", () => {
    const parsed = parseTranscript("[Coach]: Hello  \r\n\r\n[Client]: Hi\r\n[Coach]: Goal?\r\n[Client]: Yes");
    expect(parsed.turns).toHaveLength(4);
    expect(parsed.turns[0]).toMatchObject({ lineNumber: 1, speaker: "Coach", text: "Hello" });
    expect(parsed.numberedTranscript).toContain("L4 [Client]: Yes");
    expect(parsed.originalTranscript).toContain("\r\n");
  });

  it.each(["kickoff-01.txt", "kickoff-02.txt", "coaching-01.txt", "coaching-02.txt"])(
    "parses the supplied fixture %s without lossy chunking",
    (name) => {
      const source = fixture(name);
      const parsed = parseTranscript(source);
      expect(parsed.originalTranscript).toBe(source);
      expect(parsed.turns.length).toBeGreaterThan(100);
      expect(parsed.numberedTranscript.split("\n")).toHaveLength(parsed.turns.length);
    },
  );

  it("rejects text that does not resemble speaking turns", () => {
    expect(() => parseTranscript("Coach: hello\nClient: hi\nCoach: ok\nClient: done")).toThrowError(
      AppError,
    );
  });
});
