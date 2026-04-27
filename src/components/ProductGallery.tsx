import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

const THUMBS_VISIBLE = 5;

interface ImageNode {
  url: string;
  altText: string | null;
}

interface Props {
  images: ImageNode[];
  title: string;
  /** Optional externally controlled active index (e.g. when a colour swatch is picked). */
  activeIndex?: number;
}

export const ProductGallery = ({ images, title, activeIndex }: Props) => {
  const [active, setActive] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });
  const trackRef = useRef<HTMLDivElement>(null);

  // Sync external activeIndex (colour swatch click) into local state
  useEffect(() => {
    if (activeIndex == null) return;
    if (activeIndex < 0 || activeIndex >= images.length) return;
    setActive(activeIndex);
    // also scroll mobile carousel into view
    const el = trackRef.current;
    if (el) el.scrollTo({ left: activeIndex * el.clientWidth, behavior: "smooth" });
  }, [activeIndex, images.length]);

  const safeImages = images.length > 0 ? images : [];
  const current = safeImages[active];
  const maxStart = Math.max(0, safeImages.length - THUMBS_VISIBLE);

  // Keep the active thumbnail visible inside the window
  useEffect(() => {
    if (active < thumbStart) setThumbStart(active);
    else if (active >= thumbStart + THUMBS_VISIBLE)
      setThumbStart(Math.min(maxStart, active - THUMBS_VISIBLE + 1));
  }, [active, thumbStart, maxStart]);

  useEffect(() => {
    if (lightbox) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setLightbox(false);
        if (e.key === "ArrowRight") setActive((a) => Math.min(a + 1, safeImages.length - 1));
        if (e.key === "ArrowLeft") setActive((a) => Math.max(a - 1, 0));
      };
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [lightbox, safeImages.length]);

  // Mobile swipe via scroll snap, sync active index on scroll
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ active: true, x, y });
  };

  if (safeImages.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center text-sm text-muted-foreground">
        Kein Bild
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Thumbnails — desktop vertical (windowed) */}
        {safeImages.length > 1 && (
          <div className="order-2 hidden flex-col items-center gap-2 md:order-1 md:flex">
            {safeImages.length > THUMBS_VISIBLE && (
              <button
                type="button"
                onClick={() => setThumbStart((s) => Math.max(0, s - 1))}
                disabled={thumbStart === 0}
                className="flex h-6 w-16 items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Vorherige Bilder"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
            {safeImages.slice(thumbStart, thumbStart + THUMBS_VISIBLE).map((img, i) => {
              const idx = thumbStart + i;
              return (
                <button
                  key={img.url + idx}
                  onClick={() => setActive(idx)}
                  className={cn(
                    "relative h-20 w-16 overflow-hidden border transition",
                    idx === active ? "border-primary" : "border-transparent hover:border-border",
                  )}
                  aria-label={`Bild ${idx + 1} ansehen`}
                >
                  <img
                    src={img.url}
                    alt={img.altText ?? `${title} ${idx + 1}`}
                    className="h-full w-full object-contain"
                  />
                </button>
              );
            })}
            {safeImages.length > THUMBS_VISIBLE && (
              <button
                type="button"
                onClick={() => setThumbStart((s) => Math.min(maxStart, s + 1))}
                disabled={thumbStart >= maxStart}
                className="flex h-6 w-16 items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Weitere Bilder"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Main image — desktop with hover zoom */}
        <div className="order-1 flex-1 md:order-2">
          <div
            className="group relative hidden aspect-[4/5] cursor-zoom-in overflow-hidden md:block"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
            onClick={() => setLightbox(true)}
          >
            <img
              src={current.url}
              alt={current.altText ?? title}
              className="h-full w-full object-contain p-6 transition-transform duration-300 ease-out"
              style={
                zoom.active
                  ? { transformOrigin: `${zoom.x}% ${zoom.y}%`, transform: "scale(1.65)" }
                  : undefined
              }
            />
            <div className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-border bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
            </div>
          </div>

          {/* Mobile: scroll-snap carousel */}
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto md:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {safeImages.map((img, i) => (
              <button
                key={img.url + i}
                onClick={() => setLightbox(true)}
                className="relative h-full w-full flex-shrink-0 snap-center"
              >
                <img
                  src={img.url}
                  alt={img.altText ?? `${title} ${i + 1}`}
                  className="h-full w-full object-contain p-4"
                />
              </button>
            ))}
          </div>

          {/* Mobile dots */}
          {safeImages.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5 md:hidden">
              {safeImages.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition",
                    i === active ? "w-4 bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/95">
          <button
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center bg-background/10 text-background hover:bg-background/20"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>

          {safeImages.length > 1 && (
            <>
              <button
                onClick={() => setActive((a) => Math.max(a - 1, 0))}
                disabled={active === 0}
                className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center bg-background/10 text-background hover:bg-background/20 disabled:opacity-30"
                aria-label="Vorheriges Bild"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => setActive((a) => Math.min(a + 1, safeImages.length - 1))}
                disabled={active === safeImages.length - 1}
                className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center bg-background/10 text-background hover:bg-background/20 disabled:opacity-30"
                aria-label="Nächstes Bild"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={current.url}
            alt={current.altText ?? title}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-background/70">
            {active + 1} / {safeImages.length}
          </div>
        </div>
      )}
    </>
  );
};
