import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Fichiers privés du serveur : PDF des kits et des relevés d'associations, rangés sur le
 * disque sous FILES_DIR (volume Docker `/data/files` sur le VPS, sauvegardé avec la base). Même découpage que les
 * anciens buckets : `<bucket>/<chemin>`, si bien que les chemins enregistrés en base (`statement_path`) restent valables.
 * Jamais servis directement : les routes vérifient les droits puis renvoient le contenu.
 */

export type Bucket = "asso-kits" | "asso-statements";

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function root(): string {
  return resolve(process.env.FILES_DIR ?? ".data/files");
}

/** Chemin absolu d'un fichier ; refuse tout chemin qui sortirait du bucket (`..`, chemin absolu, caractère inattendu). */
export function filePath(bucket: Bucket, path: string, base = root()): string {
  const segments = path.split("/");
  if (!segments.length || !segments.every((s) => SEGMENT.test(s) && s !== "." && s !== ".."))
    throw new Error(`Chemin de fichier refusé : ${path}`);
  const dir = resolve(base, bucket);
  const full = resolve(dir, ...segments);
  if (!full.startsWith(dir + sep)) throw new Error(`Chemin de fichier refusé : ${path}`);
  return full;
}

/** Contenu du fichier, ou null s'il n'existe pas (ou plus). */
export async function readStoredFile(bucket: Bucket, path: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath(bucket, path));
  } catch {
    return null;
  }
}

/** Écrit (ou remplace) le fichier ; l'écriture passe par un fichier temporaire pour ne jamais laisser un PDF tronqué. */
export async function storeFile(bucket: Bucket, path: string, content: Buffer): Promise<void> {
  const full = filePath(bucket, path);
  await mkdir(dirname(full), { recursive: true });
  const temp = join(dirname(full), `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  await writeFile(temp, content);
  await rename(temp, full);
}
