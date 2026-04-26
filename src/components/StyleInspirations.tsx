import officeImg from "@/assets/style-inspirations/office.jpg";
import weekendImg from "@/assets/style-inspirations/weekend.jpg";
import eveningImg from "@/assets/style-inspirations/evening.jpg";

interface Props {
  productTitle: string;
}

const ideas = [
  {
    img: officeImg,
    eyebrow: "Im Büro",
    title: "Klassisch zum Sakko",
    text: "Kombiniert mit Blazer und feiner Anzughose — ein souveräner Auftritt für den Arbeitsalltag.",
  },
  {
    img: weekendImg,
    eyebrow: "Am Wochenende",
    title: "Lässig zur Chino",
    text: "Locker getragen mit Chino oder Jeans und Sneakern — entspannt, ohne nachlässig zu wirken.",
  },
  {
    img: eveningImg,
    eyebrow: "Für den Abend",
    title: "Elegant zum Dinner",
    text: "Mit dunkler Hose und edlem Sakko — perfekt für Restaurant, Bar oder besondere Anlässe.",
  },
];

export const StyleInspirations = ({ productTitle }: Props) => {
  return (
    <section className="container-editorial border-t border-border py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Style-Ideen</p>
      <h2 className="mt-2 font-display text-3xl md:text-4xl">So trägst du es</h2>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Drei Outfit-Ideen, mit denen <span className="text-foreground">{productTitle}</span> bestens zur Geltung kommt.
      </p>

      <div className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-3">
        {ideas.map((idea) => (
          <article key={idea.title} className="group">
            <div className="aspect-[4/5] overflow-hidden bg-secondary">
              <img
                src={idea.img}
                alt={idea.title}
                loading="lazy"
                width={768}
                height={960}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{idea.eyebrow}</p>
              <h3 className="mt-1 font-display text-xl">{idea.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">{idea.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
