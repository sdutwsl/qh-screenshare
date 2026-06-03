export interface DisplaySource {
  id: string;
  name: string;
  thumbnail: string | null;
}

export interface DisplayMediaResult {
  stream: unknown;
  sourceName: string;
}
