import "server-only";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "./db";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { ext: "gif", mime: "image/gif", test: (b) => b.subarray(0, 4).toString("ascii") === "GIF8" },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/**
 * Type is decided by the file's own bytes, never by the browser-supplied
 * `type` or the extension. Anything not on this list is rejected, which rules
 * out SVG (script-carrying) and executables by construction.
 */
export function sniffImage(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 16) return null;
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return { ext: sig.ext, mime: sig.mime };
  }
  return null;
}

/** Read dimensions straight from the container header (no image library). */
export function imageSize(buffer: Buffer, ext: string): { width: number; height: number } | null {
  try {
    if (ext === "png") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (ext === "gif") {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (ext === "webp") {
      const format = buffer.subarray(12, 16).toString("ascii");
      if (format === "VP8X") {
        const w = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const h = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        return { width: w, height: h };
      }
      if (format === "VP8 ") {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
      if (format === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    if (ext === "jpg") {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface StoredFile {
  url: string;
  bytes: number;
  mime: string;
  width: number | null;
  height: number | null;
}

export async function storeUpload(file: File): Promise<{ ok: true; file: StoredFile } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Arquivo vazio." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Arquivo acima de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(buffer);
  if (!sniffed) {
    return { ok: false, error: "Formato não reconhecido. Envie JPG, PNG, WEBP ou GIF." };
  }
  const size = imageSize(buffer, sniffed.ext);
  if (size && (size.width > 12000 || size.height > 12000)) {
    return { ok: false, error: "Imagem com dimensões excessivas." };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${sniffed.ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return {
    ok: true,
    file: {
      url: `/uploads/${name}`,
      bytes: buffer.length,
      mime: sniffed.mime,
      width: size?.width ?? null,
      height: size?.height ?? null,
    },
  };
}

export function kindFromMime(mime: string): "image" | "gif" | "video" {
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("video/")) return "video";
  return "image";
}
