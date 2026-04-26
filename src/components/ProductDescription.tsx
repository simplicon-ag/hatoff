interface Props {
  description: string;
  /** "default" = stacked (used in accordion). "split" = 2-column intro|features layout. */
  layout?: "default" | "split";
}

// Keywords that mark structured product info inside Shopify's flowing description
const KEYS = [
  "Material",
  "Pflege",
  "Passform",
  "Farbe",
  "Grösse",
  "Größe",
  "Schnitt",
  "Verschluss",
  "Futter",
  "Eigenschaften",
] as const;

interface Pair {
  label: string;
  values: string[]; // bullet points
}

interface Section {
  intro: string;
  pairs: Pair[];
}

// Split a value string into bullet items.
// Handles: comma lists, semicolons, percentages ("63 % Baumwolle, 36 % Leinen"),
// and care instruction sentences ("Schonwaschgang 30 °C, nicht bleichen, ...").
function splitToBullets(label: string, value: string): string[] {
  const cleaned = value.replace(/\s+/g, " ").trim().replace(/[.,;]\s*$/, "");

  // Material: split on comma — items typically "63 % Baumwolle"
  if (label === "Material") {
    return cleaned.split(/\s*,\s*/).filter(Boolean);
  }

  // Pflege: split on commas/semicolons — items are short imperatives
  if (label === "Pflege") {
    return cleaned.split(/\s*[,;]\s*/).filter(Boolean);
  }

  // Single-value attributes
  return [cleaned];
}

function parseDescription(raw: string): Section {
  if (!raw) return { intro: "", pairs: [] };

  // Normalise common Shopify quirks: glued sentences and missing newlines.
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\.([A-ZÄÖÜ])/g, ". $1") // add space after sentence-ending periods
    .replace(/\s+/g, " ")
    .trim();

  // Insert a marker before each known keyword (with or without colon),
  // so we can split a single-line blob into intro + key/value pairs.
  // We require either a colon OR the keyword followed by a capitalised word (e.g. "Material 63 %").
  const keyAlt = KEYS.join("|");
  const splitter = new RegExp(`\\s+(?=(?:${keyAlt})(?::|\\s+[0-9A-ZÄÖÜ%]))`, "g");
  text = text.replace(splitter, "\n");

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const introParts: string[] = [];
  const pairs: Pair[] = [];

  const lineRegex = new RegExp(`^(${keyAlt}):?\\s+(.+)$`);

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (match) {
      const label = match[1];
      const value = match[2].trim();
      pairs.push({ label, values: splitToBullets(label, value) });
    } else {
      introParts.push(line);
    }
  }

  return { intro: introParts.join("\n\n"), pairs };
}

import { forwardRef } from "react";

export const ProductDescription = forwardRef<HTMLDivElement, Props>(({ description, layout = "default" }, ref) => {
  const { intro, pairs } = parseDescription(description);

  if (!intro && pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Beschreibung vorhanden.</p>;
  }

  // Split layout: Intro left, all bullets/features right (Casa Moda style)
  if (layout === "split") {
    // Flatten all bullet points across pairs into a single feature list.
    const features: string[] = [];
    const meta: Pair[] = [];
    for (const p of pairs) {
      if (p.label === "Material" || p.label === "Pflege") {
        meta.push(p);
      } else if (p.values.length > 1) {
        features.push(...p.values);
      } else {
        features.push(`${p.label}: ${p.values[0]}`);
      }
    }

    return (
      <div ref={ref} className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="space-y-6">
          {intro && (
            <p className="whitespace-pre-line text-[15px] leading-[1.75] text-foreground/85">
              {intro}
            </p>
          )}
          {meta.length > 0 && (
            <dl className="space-y-4 pt-2">
              {meta.map((p) => (
                <div key={p.label}>
                  <dt className="text-sm font-semibold text-foreground">{p.label}</dt>
                  <dd className="mt-1 text-sm text-foreground/80">
                    {p.values.join(", ")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {features.length > 0 && (
          <ul className="space-y-3 text-[15px] leading-relaxed text-foreground/85 md:pt-1">
            {features.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] inline-block h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-7">
      {intro && (
        <p className="whitespace-pre-line text-[15px] leading-[1.7] text-foreground/85">
          {intro}
        </p>
      )}

      {pairs.length > 0 && (
        <div className="space-y-5 border-t border-border pt-5">
          {pairs.map((p) => (
            <div key={p.label} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:gap-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {p.label}
              </p>
              {p.values.length > 1 ? (
                <ul className="space-y-1.5 text-sm leading-relaxed text-foreground/85">
                  {p.values.map((v, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span aria-hidden className="mt-[0.55em] inline-block h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-foreground/85">{p.values[0]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ProductDescription.displayName = "ProductDescription";
