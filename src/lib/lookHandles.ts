// Look-Handle Helfer
//
// Ein Look-Handle kann optional einen Farb-Override im URL-Fragment-Stil enthalten:
//   "casa-moda-pullover-14504#color=Dunkelblau"
//
// Damit lässt sich pro Look festlegen, welche Farbvariante eines Mehrfarb-Produkts
// verwendet werden soll — ohne Änderung am DB-Schema (Handle bleibt ein String).

export interface ParsedHandle {
  handle: string;            // Reiner Shopify-Handle (ohne Fragment)
  color?: string;            // Optionale Farbe (z.B. "Dunkelblau")
}

export function parseLookHandle(raw: string): ParsedHandle {
  const [handle, fragment] = raw.split("#");
  if (!fragment) return { handle };
  const params = new URLSearchParams(fragment);
  const color = params.get("color") ?? undefined;
  return { handle, color };
}

/**
 * Aus einer Liste roher Handle-Strings: liefert die reinen Handles + die
 * recommendedColors-Map, die der LookSetBuilder erwartet (Handle → Farb-Liste).
 */
export function splitHandlesAndColors(rawHandles: string[]): {
  handles: string[];
  recommendedColors: Record<string, string[]>;
} {
  const handles: string[] = [];
  const recommendedColors: Record<string, string[]> = {};
  for (const raw of rawHandles) {
    const { handle, color } = parseLookHandle(raw);
    handles.push(handle);
    if (color) {
      recommendedColors[handle] = recommendedColors[handle]
        ? [...recommendedColors[handle], color]
        : [color];
    }
  }
  return { handles, recommendedColors };
}
