import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { LookCard } from "@/components/LookCard";
import { welten } from "@/data/looks";
import { useCuratedLooks } from "@/hooks/useCuratedLooks";

const LooksPage = () => {
  const [params, setParams] = useSearchParams();
  const welt = params.get("welt");
  const { looks } = useCuratedLooks();

  const filtered = useMemo(() => (welt ? looks.filter((l) => l.welt === welt) : looks), [welt, looks]);

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Looks</p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">Komplette Looks, kuratiert für dich.</h1>

        <div className="mt-10 flex flex-wrap gap-2">
          <button
            onClick={() => setParams({})}
            className={`rounded-full border px-4 py-2 text-sm ${!welt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary"}`}
          >
            Alle
          </button>
          {welten.map((w) => (
            <button
              key={w.id}
              onClick={() => setParams({ welt: w.id })}
              className={`rounded-full border px-4 py-2 text-sm ${welt === w.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary"}`}
            >
              {w.title}
            </button>
          ))}
        </div>
      </section>

      <section className="container-editorial py-16">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">Keine Looks in dieser Welt — bald mehr.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => <LookCard key={l.slug} look={l} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default LooksPage;
