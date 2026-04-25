import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type SizeRow = { label: string; values: (string | null)[] };
type SizeTable = {
  fit: string;
  category: string;
  sizeLabels: string[];
  rows: SizeRow[];
};
interface Guide {
  brand: string;
  source_url: string;
  fetched_at: string;
  tables: SizeTable[];
}

const BRAND_LABEL: Record<string, string> = {
  "casa-moda": "CASA MODA",
  venti: "VENTI",
};

const Groessen = () => {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke("size-guide", {
        body: {},
      });
      if (cancelled) return;
      if (error) {
        setError(error.message ?? "Grössentabellen konnten nicht geladen werden.");
      } else {
        setGuides(data?.guides ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group tables per category for tidy display
  const renderGuide = (g: Guide) => {
    const byCategory = new Map<string, SizeTable[]>();
    for (const t of g.tables) {
      if (!byCategory.has(t.category)) byCategory.set(t.category, []);
      byCategory.get(t.category)!.push(t);
    }
    const categories = Array.from(byCategory.entries());

    if (categories.length === 0) {
      return (
        <p className="py-8 text-sm text-muted-foreground">
          Keine Tabellen gefunden.
        </p>
      );
    }

    return (
      <Accordion
        type="multiple"
        defaultValue={categories.map(([c]) => c)}
        className="w-full"
      >
        {categories.map(([category, tables]) => (
          <AccordionItem key={category} value={category} className="border-border">
            <AccordionTrigger className="text-sm font-medium uppercase tracking-[0.2em] hover:no-underline">
              {category}
            </AccordionTrigger>
            <AccordionContent className="space-y-8 pt-4">
              {tables.map((t, idx) => (
                <div key={idx} className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t.fit}
                  </p>
                  <div className="overflow-x-auto rounded-sm border border-border">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-secondary/60">
                          <th className="border-b border-border px-3 py-2 text-left font-medium">
                            Grösse
                          </th>
                          {t.sizeLabels.map((s, i) => (
                            <th
                              key={i}
                              className="border-b border-border px-3 py-2 text-left font-medium"
                            >
                              {s}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className={ri % 2 === 0 ? "" : "bg-secondary/30"}
                          >
                            <td className="border-b border-border/60 px-3 py-2 font-medium">
                              {row.label}
                            </td>
                            {row.values.map((v, vi) => (
                              <td
                                key={vi}
                                className="border-b border-border/60 px-3 py-2 text-foreground/80"
                              >
                                {v ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Service
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">
          Grössentabellen.
        </h1>
        <p className="mt-4 max-w-xl text-foreground/70">
          Aktuelle Massangaben unserer Marken — direkt aus den offiziellen
          Webshops geladen. Miss in cm und vergleiche mit den Werten unten.
        </p>
      </section>

      <section className="container-editorial py-12">
        {loading ? (
          <p className="py-16 text-center text-muted-foreground">
            Tabellen werden geladen …
          </p>
        ) : error ? (
          <p className="py-16 text-center text-destructive">{error}</p>
        ) : guides.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Aktuell keine Tabellen verfügbar.
          </p>
        ) : (
          <Tabs defaultValue={guides[0]?.brand} className="w-full">
            <TabsList className="mb-8">
              {guides.map((g) => (
                <TabsTrigger key={g.brand} value={g.brand}>
                  {BRAND_LABEL[g.brand] ?? g.brand}
                </TabsTrigger>
              ))}
            </TabsList>
            {guides.map((g) => (
              <TabsContent key={g.brand} value={g.brand} className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted-foreground">
                  <p>
                    Quelle:{" "}
                    <a
                      href={g.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-primary"
                    >
                      {g.source_url.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                  <p>
                    Aktualisiert:{" "}
                    {new Date(g.fetched_at).toLocaleDateString("de-CH", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {renderGuide(g)}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="mt-12 rounded-sm border border-border bg-secondary/30 p-6 text-sm text-foreground/80">
          <h2 className="mb-2 font-display text-lg">So misst du richtig</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              <strong>Brust:</strong> waagerecht um die stärkste Stelle, Arme locker.
            </li>
            <li>
              <strong>Taille:</strong> in Höhe des Bauchnabels, ohne einzuziehen.
            </li>
            <li>
              <strong>Hüfte:</strong> waagerecht um die stärkste Stelle.
            </li>
            <li>
              <strong>Innenbeinlänge:</strong> vom Schritt bis zum Boden, ohne Schuhe.
            </li>
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Groessen;
