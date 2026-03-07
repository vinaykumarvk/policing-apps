import { query } from "../db";
import type { ForensicParser } from "./types";
import { UfedParser } from "./ufed-parser";
import { XryParser } from "./xry-parser";
import { OxygenParser } from "./oxygen-parser";
import { FtkParser } from "./ftk-parser";
import { AxiomParser } from "./axiom-parser";
import { BelkasoftParser } from "./belkasoft-parser";

/** Registry of all available forensic parsers. */
const parsers = new Map<string, ForensicParser>([
  ["UFED", new UfedParser()],
  ["XRY", new XryParser()],
  ["OXYGEN", new OxygenParser()],
  ["FTK", new FtkParser()],
  ["AXIOM", new AxiomParser()],
  ["BELKASOFT", new BelkasoftParser()],
]);

/**
 * Get a parser instance by type.
 * Validates that the parser type is registered and active in the database.
 */
export async function getParser(parserType: string): Promise<ForensicParser | null> {
  const parser = parsers.get(parserType.toUpperCase());
  if (!parser) return null;

  // Verify parser is active in database config
  const result = await query(
    `SELECT is_active FROM parser_config WHERE parser_type = $1`,
    [parserType.toUpperCase()],
  );
  if (result.rows.length > 0 && !result.rows[0].is_active) return null;

  return parser;
}

/**
 * Get parser configuration from the database.
 */
export async function getParserConfig(parserType: string): Promise<Record<string, unknown>> {
  const result = await query(
    `SELECT config_jsonb FROM parser_config WHERE parser_type = $1 AND is_active = TRUE`,
    [parserType.toUpperCase()],
  );
  return result.rows.length > 0 ? result.rows[0].config_jsonb : {};
}

/**
 * List all available parsers with their database config status.
 */
export async function listParsers(): Promise<Array<{ parserType: string; name: string; isActive: boolean; supportedExtensions: string[] }>> {
  const result = await query(
    `SELECT parser_type, parser_name, is_active, supported_extensions FROM parser_config ORDER BY parser_name`,
  );
  return result.rows.map((r) => ({
    parserType: r.parser_type,
    name: r.parser_name,
    isActive: r.is_active,
    supportedExtensions: r.supported_extensions,
  }));
}

/**
 * Detect parser type from filename extension.
 */
export function detectParserType(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [type, parser] of parsers) {
    if (parser.supportedExtensions.some((ext) => lower.endsWith(ext))) {
      return type;
    }
  }
  return null;
}
