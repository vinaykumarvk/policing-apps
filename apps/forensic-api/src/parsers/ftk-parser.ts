import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for AccessData FTK (Forensic Toolkit) image and report files.
 * Handles .ad1 custom images, .e01 EnCase evidence files, and ZIP archives.
 */
export class FtkParser implements ForensicParser {
  parserType = "FTK";
  name = "AccessData FTK";
  supportedExtensions = [".ad1", ".e01", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`FTK parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
