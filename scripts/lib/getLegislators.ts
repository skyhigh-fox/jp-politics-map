import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Legislator } from "../../src/types";

export async function getLegislators(): Promise<Legislator[]> {
  const filePath = path.join(process.cwd(), "data", "legislators.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as Legislator[];
}
