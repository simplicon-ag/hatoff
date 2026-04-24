// SizeAdvisor — universal size guide drawer with floating trigger
// Used via SizeAdvisorProvider (in App) + useSizeAdvisor() hook to open with optional product context.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Ruler, Loader2, Check, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brand,
  BrandGuide,
  detectBrand,
  detectCategory,
  fetchSizeGuides,
  knownSizeToMeasurements,
  ProductCategory,
  recommendFromMeasurements,
  selectTablesFor,
  SizeRecommendation,
} from "@/lib/sizing";
import type { ShopifyProduct } from "@/lib/shopify";
import { cn } from "@/lib/utils";

interface OpenOptions {
  product?: ShopifyProduct | null;
  brand?: Brand;
  category?: ProductCategory;
}

interface Ctx {
  open: (opts?: OpenOptions) => void;
  close: () => void;
  isOpen: boolean;
}

const SizeAdvisorContext = createContext<Ctx | null>(null);

export const useSizeAdvisor = () => {
  const ctx = useContext(SizeAdvisorContext);
  if (!ctx) throw new Error("useSizeAdvisor must be used within SizeAdvisorProvider");
  return ctx;
};

const BRAND_LABEL: Record<Brand, string> = {
  venti: "VENTI",
  "casa-moda": "CASA MODA",
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  hemd: "Hemd",
  polo: "Polo",
  anzughose: "Anzughose",
  sakko: "Sakko",
  weste: "Weste",
  hose: "Hose",
  jeans: "Jeans",
  bermuda: "Bermuda",
  pullover: "Pullover",
  strick: "Strick",
  jacke: "Jacke",
  accessoire: "Accessoire",
  unknown: "Allgemein",
};

export const SizeAdvisorProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<OpenOptions>({});

  const open = useCallback((o?: OpenOptions) => {
    setOpts(o ?? {});
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SizeAdvisorContext.Provider value={{ open, close, isOpen }}>
      {children}
      <SizeAdvisorSheet isOpen={isOpen} onOpenChange={setIsOpen} opts={opts} />
      <FloatingTrigger onClick={() => open()} hidden={isOpen} />
    </SizeAdvisorContext.Provider>
  );
};

const FloatingTrigger = ({ onClick, hidden }: { onClick: () => void; hidden: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Größenberater öffnen"
    className={cn(
      "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium shadow-lg transition-all hover:scale-105 hover:shadow-xl",
      hidden && "pointer-events-none opacity-0",
    )}
  >
    <Ruler className="h-4 w-4" />
    <span className="hidden sm:inline">Größenberater</span>
  </button>
);

interface SheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  opts: OpenOptions;
}

const SizeAdvisorSheet = ({ isOpen, onOpenChange, opts }: SheetProps) => {
  const [guides, setGuides] = useState<BrandGuide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Brand & category state — start from opts, but allow user override
  const initialBrand = opts.brand ?? detectBrand(opts.product ?? null) ?? "venti";
  const initialCategory = opts.category ?? detectCategory(opts.product ?? null);
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [category, setCategory] = useState<ProductCategory>(
    initialCategory === "unknown" ? "hemd" : initialCategory,
  );

  // When opts change (drawer reopened with new product), sync state
  useEffect(() => {
    if (!isOpen) return;
    setBrand(opts.brand ?? detectBrand(opts.product ?? null) ?? "venti");
    const c = opts.category ?? detectCategory(opts.product ?? null);
    setCategory(c === "unknown" ? "hemd" : c);
  }, [isOpen, opts]);

  // Load guides on first open
  useEffect(() => {
    if (!isOpen || guides.length > 0 || loading) return;
    setLoading(true);
    setError(null);
    fetchSizeGuides()
      .then((g) => setGuides(g))
      .catch((e) => setError(e instanceof Error ? e.message : "Größentabellen konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [isOpen, guides.length, loading]);

  const guide = guides.find((g) => g.brand === brand);
  const tables = useMemo(() => selectTablesFor(guide, category), [guide, category]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border bg-background p-6">
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Ruler className="h-5 w-5" />
            Größenberater
          </SheetTitle>
          <SheetDescription>
            Finde die richtige Größe — direkt aus den offiziellen Marken-Tabellen.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 p-6">
          {/* Product context (if any) */}
          {opts.product && (
            <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3">
              {opts.product.node.images.edges[0]?.node.url && (
                <img
                  src={opts.product.node.images.edges[0].node.url}
                  alt=""
                  className="h-14 w-12 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Aktuelles Produkt
                </p>
                <p className="text-sm font-medium leading-tight">{opts.product.node.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {BRAND_LABEL[brand]} · {CATEGORY_LABEL[category]}
                </p>
              </div>
            </div>
          )}

          {/* Brand + category selectors (always visible so user can switch) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Marke
              </Label>
              <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venti">VENTI</SelectItem>
                  <SelectItem value="casa-moda">CASA MODA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Kategorie
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hemd">Hemd</SelectItem>
                  <SelectItem value="polo">Polo</SelectItem>
                  <SelectItem value="anzughose">Anzughose</SelectItem>
                  <SelectItem value="hose">Chino / Hose</SelectItem>
                  <SelectItem value="jeans">Jeans</SelectItem>
                  <SelectItem value="sakko">Sakko</SelectItem>
                  <SelectItem value="weste">Weste</SelectItem>
                  <SelectItem value="pullover">Pullover / Strick</SelectItem>
                  <SelectItem value="bermuda">Bermuda</SelectItem>
                  <SelectItem value="jacke">Jacke</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading / error states */}
          {loading && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Größentabellen werden geladen …
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && tables.length === 0 && (
            <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Für diese Kategorie liegt aktuell keine offizielle Tabelle vor. Bitte wähle eine andere Kategorie oder kontaktiere uns.
            </div>
          )}

          {!loading && tables.length > 0 && (
            <Tabs defaultValue="quick" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="quick">Bekannte Größe</TabsTrigger>
                <TabsTrigger value="measure">Maße</TabsTrigger>
                <TabsTrigger value="table">Tabelle</TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="mt-4">
                <QuickSizePanel tables={tables} category={category} />
              </TabsContent>
              <TabsContent value="measure" className="mt-4">
                <MeasurePanel tables={tables} category={category} />
              </TabsContent>
              <TabsContent value="table" className="mt-4">
                <TablePanel tables={tables} />
              </TabsContent>
            </Tabs>
          )}

          {/* Source attribution */}
          {guide && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              Quelle:&nbsp;
              <a
                href={guide.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {BRAND_LABEL[brand]} Größentabelle <ExternalLink className="h-3 w-3" />
              </a>
              &nbsp;· Stand {new Date(guide.fetched_at).toLocaleDateString("de-CH")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ───────── Panels ───────── */

interface PanelProps {
  tables: ReturnType<typeof selectTablesFor>;
  category: ProductCategory;
}

const QuickSizePanel = ({ tables, category }: PanelProps) => {
  const [letter, setLetter] = useState<string>("L");
  const [collar, setCollar] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [unit, setUnit] = useState<"cm" | "inch">("cm");

  const wantsCollar = category === "hemd";
  const wantsWaist = ["anzughose", "hose", "jeans", "bermuda"].includes(category);

  const measurements = knownSizeToMeasurements({
    letter: !wantsCollar && !wantsWaist ? letter : undefined,
    collar: collar ? parseFloat(collar) : undefined,
    waist: waist ? parseFloat(waist) : undefined,
    waistUnit: unit,
  });

  const recommendations: SizeRecommendation[] = tables
    .map((t) => recommendFromMeasurements(t, measurements))
    .filter((r): r is SizeRecommendation => !!r);

  return (
    <div className="space-y-4">
      {wantsCollar && (
        <div className="space-y-1.5">
          <Label htmlFor="collar">Kragenweite (cm) — z.B. 41</Label>
          <Input
            id="collar"
            type="number"
            inputMode="decimal"
            placeholder="41"
            value={collar}
            onChange={(e) => setCollar(e.target.value)}
          />
        </div>
      )}
      {wantsWaist && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="waist">Bundweite</Label>
            <Input
              id="waist"
              type="number"
              inputMode="decimal"
              placeholder={unit === "cm" ? "84" : "33"}
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Einheit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as "cm" | "inch")}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="inch">inch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {!wantsCollar && !wantsWaist && (
        <div className="space-y-1.5">
          <Label htmlFor="letter">Deine gewohnte Größe</Label>
          <Select value={letter} onValueChange={setLetter}>
            <SelectTrigger id="letter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["XS", "S", "M", "L", "XL", "XXL", "3XL"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Das System rechnet auf Brustumfang um und vergleicht mit der offiziellen Tabelle.
          </p>
        </div>
      )}

      <RecommendationList recommendations={recommendations} />
    </div>
  );
};

const MeasurePanel = ({ tables, category }: PanelProps) => {
  const [chest, setChest] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [hip, setHip] = useState<string>("");

  const measurements = {
    chest: chest ? parseFloat(chest) : undefined,
    waist: waist ? parseFloat(waist) : undefined,
    hip: hip ? parseFloat(hip) : undefined,
  };

  const recommendations: SizeRecommendation[] = tables
    .map((t) => recommendFromMeasurements(t, measurements))
    .filter((r): r is SizeRecommendation => !!r);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Miss direkt am Körper — Maßband locker, nicht eng. Alle Werte in cm.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="chest" className="text-xs">Oberweite</Label>
          <Input id="chest" type="number" inputMode="decimal" placeholder="108" value={chest} onChange={(e) => setChest(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="waist-m" className="text-xs">Taille</Label>
          <Input id="waist-m" type="number" inputMode="decimal" placeholder="92" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hip" className="text-xs">Hüfte</Label>
          <Input id="hip" type="number" inputMode="decimal" placeholder="104" value={hip} onChange={(e) => setHip(e.target.value)} />
        </div>
      </div>

      <RecommendationList recommendations={recommendations} />
    </div>
  );
};

const RecommendationList = ({ recommendations }: { recommendations: SizeRecommendation[] }) => {
  if (recommendations.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
        Mindestens einen Wert eingeben für eine Empfehlung.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Empfohlene Größen
      </p>
      {recommendations.map((r, i) => (
        <div key={i} className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.category} · {r.fit}
              </p>
              <p className="mt-1 font-display text-2xl">{r.size}</p>
            </div>
            <Badge className="gap-1.5"><Check className="h-3 w-3" /> Beste Übereinstimmung</Badge>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {r.matchedRows.map((m, j) => (
              <li key={j} className="flex justify-between gap-3">
                <span>{m.label}</span>
                <span>
                  Tabelle: <strong className="text-foreground">{m.value} cm</strong>
                  {" · "}
                  Du: {m.userValue} cm
                  {Math.abs(m.delta) > 0 && (
                    <span className={cn("ml-1", Math.abs(m.delta) > 4 ? "text-destructive" : "text-muted-foreground")}>
                      ({m.delta > 0 ? "+" : ""}{m.delta})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const TablePanel = ({ tables }: { tables: ReturnType<typeof selectTablesFor> }) => (
  <div className="space-y-6">
    {tables.map((t, i) => (
      <div key={i} className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {t.category} · {t.fit}
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-2 py-1.5 text-left font-medium">Maß</th>
                {t.sizeLabels.map((s, j) => (
                  <th key={j} className="px-2 py-1.5 text-center font-medium">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row, j) => (
                <tr key={j} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-left font-medium">{row.label}</td>
                  {row.values.map((v, k) => (
                    <td key={k} className="px-2 py-1.5 text-center text-muted-foreground">
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
  </div>
);

/* ───────── Inline trigger button (use in product/look pages) ───────── */

interface InlineTriggerProps {
  product?: ShopifyProduct | null;
  brand?: Brand;
  category?: ProductCategory;
  className?: string;
  variant?: "default" | "subtle";
  label?: string;
}

export const SizeAdvisorTrigger = ({
  product,
  brand,
  category,
  className,
  variant = "subtle",
  label = "Größe finden",
}: InlineTriggerProps) => {
  const { open } = useSizeAdvisor();
  return (
    <Button
      type="button"
      variant={variant === "subtle" ? "ghost" : "outline"}
      size="sm"
      onClick={() => open({ product, brand, category })}
      className={cn("h-auto gap-1.5 px-2 py-1 text-xs", className)}
    >
      <Ruler className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
};
