interface Props {
  description: string;
}

// Splits Shopify's run-together description by known keywords into a definition list.
const KEYS = ["Material", "Pflege", "Passform", "Farbe", "Grösse", "Größe", "Schnitt", "Verschluss", "Futter", "Eigenschaften"];

interface Section {
  intro: string;
  pairs: Array<{ label: string; value: string }>;
}

function parseDescription(raw: string): Section {
  if (!raw) return { intro: "", pairs: [] };
  // Insert a separator before any "Keyword:" that has no preceding whitespace
  const pattern = new RegExp(`(?<!^)(?<!\\n)(?<!\\s)(${KEYS.join("|")}):`, "g");
  const normalized = raw
    .replace(pattern, "\n$1:")
    .replace(/\.([A-ZÄÖÜ])/g, ". $1") // add space after sentences glued together
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  const introParts: string[] = [];
  const pairs: Array<{ label: string; value: string }> = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-zÄÖÜäöü]+):\s*(.+)$/);
    if (match && KEYS.includes(match[1])) {
      pairs.push({ label: match[1], value: match[2].trim() });
    } else {
      introParts.push(line);
    }
  }

  return { intro: introParts.join("\n\n"), pairs };
}

export const ProductDescription = ({ description }: Props) => {
  const { intro, pairs } = parseDescription(description);

  if (!intro && pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Beschreibung vorhanden.</p>;
  }

  return (
    <div className="space-y-6">
      {intro && (
        <p className="whitespace-pre-line text-[15px] leading-[1.7] text-foreground/85">
          {intro}
        </p>
      )}
      {pairs.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-[120px_1fr]">
          {pairs.map((p) => (
            <div key={p.label} className="contents">
              <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {p.label}
              </dt>
              <dd className="text-sm leading-relaxed text-foreground/85">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};
