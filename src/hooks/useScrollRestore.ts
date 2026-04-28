import { useEffect } from "react";

/**
 * Stellt die Scroll-Position einer Listing-Seite wieder her, wenn man
 * z.B. von einem Produktdetail zurück navigiert. Persistiert per
 * sessionStorage unter `key`.
 *
 * @param key   eindeutiger Key pro URL/Filter (z.B. `shop-scroll:?marke=Casa`)
 * @param ready true, sobald die Seite genug Inhalt hat (z.B. nicht mehr loading)
 */
export function useScrollRestore(key: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y) && y > 0) {
        let tries = 0;
        const tryScroll = () => {
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, Math.min(y, maxY));
          tries++;
          if (window.scrollY < y - 4 && tries < 30) {
            setTimeout(tryScroll, 60);
          }
        };
        requestAnimationFrame(tryScroll);
      }
    }
    const onScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key, ready]);
}
