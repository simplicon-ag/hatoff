## Ziel
Diskreter Admin-Zugang in der Fusszeile, der zu den manuellen Admin-Seiten führt.

## Vorhandene Admin-Seiten
- `/admin/import` — Manueller Produkt-Import (URL-Import, Discover, Cleanup)
- `/admin/looks` — Look-Review (Drafts, Published, Manual, Backfill)

## Umsetzung

### 1. `src/components/SiteFooter.tsx` — Admin-Bereich ergänzen
Neuen unscheinbaren Admin-Block in die rechte Service-Spalte (oder als eigene 4. Spalte) einfügen:

```tsx
<div className="space-y-3 text-sm">
  <h4 className="font-display text-base">Admin</h4>
  <ul className="space-y-2 text-muted-foreground">
    <li><Link to="/admin/import" className="hover:text-primary">Produkt-Import</Link></li>
    <li><Link to="/admin/looks" className="hover:text-primary">Look-Review</Link></li>
  </ul>
</div>
```

Da das Grid bereits `md:grid-cols-4` ist und aktuell nur 3 Spalten gefüllt sind (Brand+Newsletter spannt 2, Entdecken, Service), passt ein 4. Block ohne Layout-Anpassung.

### Bewusst NICHT enthalten
- **Keine Auth-Schutzlogik**: Die Routen sind aktuell ungeschützt (was sie schon vor dieser Änderung waren). Da du der einzige bist, der die Routen kennt, ist das pragmatisch okay — falls du später echten Schutz willst (Login + `user_roles` Tabelle mit `has_role()`), sag Bescheid, dann ziehen wir das nach.
- **Kein separates Admin-Dashboard**: Die zwei Links reichen, da nur diese beiden Seiten existieren. Kommt später eine dritte Admin-Seite dazu, einfach hier ergänzen.

## Geänderte Dateien
- `src/components/SiteFooter.tsx` (1 Block ergänzen)
