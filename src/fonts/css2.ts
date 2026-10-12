export interface Css2Face {
  /** From the comment Google puts before each block, e.g. "latin-ext". */
  subset: string;
  family: string;
  weight: number;
  style: string;
  unicodeRange: string;
  url: string;
}

export interface FontFile {
  subset: string;
  weight: string;
  unicodeRange: string;
  url: string;
}

const BLOCK = /\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
const WOFF2_SOURCE = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.woff2)\)\s*format\(['"]woff2['"]\)/;

function descriptor(body: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+);`).exec(body);
  return match ? match[1]!.trim() : null;
}

/** Parses a Google Fonts css2 response. Blocks without a subset comment or a gstatic woff2 source are skipped. */
export function parseCss2(css: string): Css2Face[] {
  const faces: Css2Face[] = [];
  for (const [, subset, body] of css.matchAll(BLOCK)) {
    const url = WOFF2_SOURCE.exec(descriptor(body!, 'src') ?? '')?.[1];
    const family = descriptor(body!, 'font-family')?.replace(/^['"]|['"]$/g, '');
    const weight = Number(descriptor(body!, 'font-weight'));
    if (!url || !family || !Number.isFinite(weight)) continue;
    faces.push({
      subset: subset!,
      family,
      weight,
      style: descriptor(body!, 'font-style') ?? 'normal',
      unicodeRange: descriptor(body!, 'unicode-range') ?? '',
      url,
    });
  }
  return faces;
}

/** Keeps the requested subsets in normal style; weights sharing one file (variable fonts) become a range. */
export function selectFaces(faces: Css2Face[], subsets: readonly string[]): FontFile[] {
  const groups = new Map<string, { face: Css2Face; weights: number[] }>();
  for (const face of faces) {
    if (face.style !== 'normal' || !subsets.includes(face.subset)) continue;
    const key = `${face.url} ${face.unicodeRange}`;
    const group = groups.get(key);
    if (group) group.weights.push(face.weight);
    else groups.set(key, { face, weights: [face.weight] });
  }
  return [...groups.values()].map(({ face, weights }) => {
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    return {
      subset: face.subset,
      weight: min === max ? String(min) : `${min} ${max}`,
      unicodeRange: face.unicodeRange,
      url: face.url,
    };
  });
}
