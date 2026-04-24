import { Link, useParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { magazinArtikel } from "@/data/looks";

const MagazinIndex = () => (
  <SiteLayout>
    <section className="container-editorial py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Magazin</p>
      <h1 className="mt-2 max-w-2xl font-display text-5xl md:text-6xl">Style-Guides, Geschichten, Inspiration.</h1>
    </section>
    <section className="container-editorial pb-16">
      <div className="grid gap-10 md:grid-cols-3">
        {magazinArtikel.map((a) => (
          <Link key={a.slug} to={`/magazin/${a.slug}`} className="group block">
            <div className="aspect-[4/3] overflow-hidden bg-secondary">
              <img src={a.image} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{a.readingTime}</p>
            <h2 className="mt-1 font-display text-2xl leading-tight group-hover:text-primary">{a.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{a.teaser}</p>
          </Link>
        ))}
      </div>
    </section>
  </SiteLayout>
);

const MagazinDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const a = magazinArtikel.find((x) => x.slug === slug);

  if (!a) {
    return (
      <SiteLayout>
        <div className="container-editorial py-32 text-center">
          <h1 className="font-display text-3xl">Artikel nicht gefunden</h1>
          <Link to="/magazin" className="mt-4 inline-block text-primary hover:underline">Zurück zum Magazin</Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <article className="container-editorial max-w-3xl py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{a.readingTime} · Magazin</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.1] md:text-5xl">{a.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{a.teaser}</p>
        <div className="mt-10 aspect-[16/10] overflow-hidden bg-secondary">
          <img src={a.image} alt={a.title} className="h-full w-full object-cover" />
        </div>
        <div className="prose prose-stone mt-12 max-w-none text-foreground/90">
          {a.content.split("\n\n").map((para, i) => {
            // simple bold support: **text**
            const html = para.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            return (
              <p
                key={i}
                className="mb-6 text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          })}
        </div>
      </article>
    </SiteLayout>
  );
};

export { MagazinIndex, MagazinDetail };
