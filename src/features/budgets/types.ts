export type Categories = { id: string; name: string };

export type CategoryReturnType =
  | { ok: true; categories: Categories[] }
  | { ok: false; error: string };
