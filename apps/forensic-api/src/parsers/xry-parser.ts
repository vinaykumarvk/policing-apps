import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for MSAB XRY extraction files.
 * Handles .xry data archives and XML reports containing
 * device extraction data from mobile forensic analysis.
 */
export class XryParser implements ForensicParser {
  parserType = "XRY";
  name = "MSAB XRY";
  supportedExtensions = [".xry", ".xml", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`XRY parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
