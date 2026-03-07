import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for Cellebrite UFED extraction reports.
 * In production, this will parse .ufdr files and XML reports
 * to extract call logs, SMS, contacts, app data, and media.
 */
export class UfedParser implements ForensicParser {
  parserType = "UFED";
  name = "Cellebrite UFED";
  supportedExtensions = [".ufdr", ".xml", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    // Stub: real implementation parses UFED extraction format
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`UFED parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
