interface Props {
  description: string;
  /** "default" = stacked (used in accordion). "split" = 2-column intro|features layout. */
  layout?: "default" | "split";
}

// Keywords that mark structured product info inside Shopify's flowing description
const KEYS = [
  "Material",
  "Pflegehinweise",
  "Pflege",
  "Passform",
  "Farbe",
  "Grösse",
  "Größe",
  "Schnitt",
  "Verschluss",
  "Futter",
  "Eigenschaften",
  "Artikelnummer",
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

  // Pflege / Pflegehinweise: split on commas/semicolons, OR — if no separators —
  // heuristically split on common care-instruction phrases (Shopify often strips commas).
  if (label === "Pflege" || label === "Pflegehinweise") {
    if (/[,;]/.test(cleaned)) {
      return cleaned.split(/\s*[,;]\s*/).filter(Boolean);
    }
    // Heuristic: insert a separator before known care phrases, then split.
    const phrases = [
      "schonwaschgang",
      "normalwaschgang",
      "handwäsche",
      "nicht waschen",
      "nicht bleichen",
      "bleichen",
      "schonende trocknung",
      "nicht im wäschetrockner",
      "im wäschetrockner",
      "nicht trocknen",
      "trocknen",
      "nicht bügeln",
      "mäßig heiß bügeln",
      "heiß bügeln",
      "bügeln",
      "nicht trockenreinigen",
      "professionelle trockenreinigung",
      "trockenreinigung",
      "professionelle nassreinigung",
      "nassreinigung",
    ];
    const pattern = new RegExp(`\\s+(?=(?:${phrases.join("|")}))`, "gi");
    const parts = cleaned.split(pattern).map((s) => s.trim()).filter(Boolean);
    // Erstes Element ggf. inkl. "normaler prozess" / "schonender prozess" am Ende
    // wieder anhängen, falls es zu kurz ist. Sonst direkt zurückgeben.
    return parts.length > 1 ? parts : [cleaned];
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

  // Footer-Werte (Artikelnummer etc.) separat anzeigen
  const FOOTER_KEYS = new Set(["Artikelnummer"]);
  const mainPairs = pairs.filter((p) => !FOOTER_KEYS.has(p.label));
  const footerPairs = pairs.filter((p) => FOOTER_KEYS.has(p.label));

  return (
    <div ref={ref} className="space-y-5 text-[15px] leading-[1.7] text-foreground/85">
      {intro && (
        <p className="whitespace-pre-line">{intro}</p>
      )}

      {mainPairs.map((p) => {
        // Mehrere Werte → Heading + Bullet-Liste (z.B. Pflegehinweise)
        if (p.values.length > 1) {
          return (
            <div key={p.label} className="space-y-2">
              <p className="font-semibold text-foreground">{p.label}:</p>
              <ul className="ml-5 list-disc space-y-1 marker:text-foreground/60">
                {p.values.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          );
        }
        // Einzelwert → Inline-Label (z.B. Material: 100 % Polyester)
        return (
          <p key={p.label}>
            <span className="font-semibold text-foreground">{p.label}:</span>{" "}
            {p.values[0]}
          </p>
        );
      })}

      {footerPairs.length > 0 && (
        <div className="pt-2 text-sm text-muted-foreground">
          {footerPairs.map((p) => (
            <p key={p.label}>
              {p.label}: {p.values[0]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

ProductDescription.displayName = "ProductDescription";

ProductDescription.displayName = "ProductDescription";
