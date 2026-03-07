import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for Oxygen Forensic Detective exports.
 * Handles .ofb backup files and XML reports with cloud data,
 * drone data, and IoT device extraction results.
 */
export class OxygenParser implements ForensicParser {
  parserType = "OXYGEN";
  name = "Oxygen Forensic";
  supportedExtensions = [".ofb", ".xml", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`Oxygen parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
