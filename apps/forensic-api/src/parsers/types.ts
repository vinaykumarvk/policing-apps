/**
 * Interface that all forensic tool parsers must implement.
 * Each parser handles a specific tool's output format and extracts
 * artifacts, entities, and relationships from the data.
 */
export interface ForensicParser {
  /** Parser type identifier (e.g., "UFED", "XRY"). */
  parserType: string;

  /** Human-readable parser name. */
  name: string;

  /** File extensions this parser can handle. */
  supportedExtensions: string[];

  /**
   * Parse input data and extract structured forensic artifacts.
   * @param input Raw input data (file content as Buffer or parsed object).
   * @param config Parser-specific configuration from parser_config table.
   * @returns Parsed result containing artifacts, entities, relationships, and warnings.
   */
  parse(input: ParserInput, config: Record<string, unknown>): Promise<ParseResult>;

  /**
   * Validate that the input is in the expected format for this parser.
   * @returns true if the input can be processed.
   */
  validate(input: ParserInput): Promise<boolean>;
}

export interface ParserInput {
  /** Raw file content. */
  data: Buffer;
  /** Original filename. */
  filename: string;
  /** MIME type if known. */
  mimeType?: string;
  /** SHA-256 checksum of the input. */
  checksum: string;
  /** Case ID this import belongs to. */
  caseId: string;
  /** Evidence source ID. */
  evidenceId?: string;
}

export interface ParsedArtifact {
  artifactType: string;
  sourcePath: string;
  contentPreview: string;
  metadata: Record<string, unknown>;
  hashSha256?: string;
}

export interface ParsedEntity {
  entityType: string;
  entityValue: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ParsedRelationship {
  sourceEntityValue: string;
  targetEntityValue: string;
  relationshipType: string;
  weight?: number;
}

export interface ParseResult {
  artifacts: ParsedArtifact[];
  entities: ParsedEntity[];
  relationships: ParsedRelationship[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}
