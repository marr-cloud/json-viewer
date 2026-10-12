// ES2025 JSON.parse source text access (Chrome 114+, Node 21+); not yet in TS lib.
interface RawJSON {
  readonly rawJSON: string;
}

interface JSON {
  rawJSON(text: string): RawJSON;
  isRawJSON(value: unknown): value is RawJSON;
}
