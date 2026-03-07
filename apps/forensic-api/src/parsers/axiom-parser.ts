import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for Magnet AXIOM case exports.
 * Handles .case files and XML exports containing computer, mobile,
 * and cloud forensic artifacts with timeline data.
 */
export class AxiomParser implements ForensicParser {
  parserType = "AXIOM";
  name = "Magnet AXIOM";
  supportedExtensions = [".case", ".xml", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`AXIOM parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
