import type { ForensicParser, ParserInput, ParseResult } from "./types";

/**
 * Stub parser for Belkasoft Evidence Center exports.
 * Handles .bec case files and XML reports containing computer and
 * mobile forensic data with carved artifacts and communications.
 */
export class BelkasoftParser implements ForensicParser {
  parserType = "BELKASOFT";
  name = "Belkasoft Evidence Center";
  supportedExtensions = [".bec", ".xml", ".zip"];

  async parse(input: ParserInput, _config: Record<string, unknown>): Promise<ParseResult> {
    return {
      artifacts: [],
      entities: [],
      relationships: [],
      warnings: [`Belkasoft parser stub: file ${input.filename} not actually parsed`],
      metadata: { parserType: this.parserType, inputSize: input.data.length },
    };
  }

  async validate(input: ParserInput): Promise<boolean> {
    return this.supportedExtensions.some((ext) => input.filename.toLowerCase().endsWith(ext));
  }
}
