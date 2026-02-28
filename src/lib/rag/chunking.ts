export interface ChunkingOptions {
  maxLength?: number;
  overlap?: number;
}

const DEFAULT_MAX_LENGTH = 1200;
const DEFAULT_OVERLAP = 200;

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isStructuralHeading(line: string): boolean {
  const value = line.trim();
  if (!value) return false;

  return (
    /^(titulo|título|capitulo|capítulo|seccion|sección|anexo|disposicion|disposición)\b/i.test(value) ||
    /^art(?:iculo|ículo)?\.?\s*\d+/i.test(value) ||
    /^\d+(\.\d+)*[).-]?\s+[A-ZÁÉÍÓÚÜÑ]/.test(value) ||
    (/^[A-ZÁÉÍÓÚÜÑ0-9 ,:;()/-]{8,}$/.test(value) && value.length <= 120)
  );
}

function splitStructuredSections(text: string): string[] {
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(cleanLine);

  const sections: string[] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (!line) {
      if (current.length > 0) {
        current.push("");
      }
      continue;
    }

    if (isStructuralHeading(line) && current.length > 0) {
      sections.push(current.join("\n").trim());
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    sections.push(current.join("\n").trim());
  }

  return sections.filter((section) => section.length > 0);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(cleanLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkStructuredText(text: string, options: ChunkingOptions = {}): string[] {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const normalized = normalizeText(text);
  const sections = splitStructuredSections(normalized);
  const chunks: string[] = [];

  const pushWithSlidingWindow = (value: string) => {
    let startIndex = 0;

    while (startIndex < value.length) {
      let endIndex = startIndex + maxLength;

      if (endIndex < value.length) {
        const lastNewline = value.lastIndexOf("\n", endIndex);
        if (lastNewline > startIndex + maxLength / 3) {
          endIndex = lastNewline;
        } else {
          const lastSpace = value.lastIndexOf(" ", endIndex);
          if (lastSpace > startIndex + maxLength / 3) {
            endIndex = lastSpace;
          }
        }
      }

      chunks.push(value.slice(startIndex, endIndex).trim());
      startIndex = Math.max(0, endIndex - overlap);

      if (endIndex >= value.length) {
        break;
      }
    }
  };

  for (const section of sections) {
    if (section.length <= maxLength) {
      chunks.push(section);
      continue;
    }
    pushWithSlidingWindow(section);
  }

  return chunks.filter((chunk) => chunk.length > 50);
}

