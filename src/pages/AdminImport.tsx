import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Play, RefreshCw, Square, Search, Trash2, Link2, CheckCircle2, Rocket } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";

type SingleImportResult = {
  success: boolean;
  action?: "created" | "updated";
  already_exists?: boolean;
  matched_by?: "handle" | "article_number";
  shopify_product_id?: string;
  handle?: string;
  title?: string;
  colors_found?: number;
  colors?: string[];
  sizes?: string[];
  images_uploaded?: number;
  price_eur?: number | null;
  compare_at_price_eur?: number | null;
  material?: string;
  article_number?: string;
  fit?: string;
  is_new?: boolean;
  features_count?: number;
  care_count?: number;
  description_length?: number;
  missing_fields?: string[];
  shopify_admin_url?: string;
  look_generation_triggered?: boolean;
  error?: string;
};

type JobRow = {
  id: string;
  state: "idle" | "running" | "stopping" | "stopped" | "done";
  dry_run: boolean;
  total: number;
  processed: number;
  created_count: number;
  error_count: number;
  message: string | null;
  started_at: string | null;
  updated_at: string;
};

type LogRow = {
  id: string;
  brand: string;
  source_url: string;
  handle: string | null;
  status: string;
  shopify_product_id: string | null;
  error_message: string | null;
  scraped_data: { title?: string; price_eur?: number | null; image_urls?: string[]; sizes?: string[] } | null;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scraping: "bg-blue-500/15 text-blue-700",
  scraped: "bg-emerald-500/15 text-emerald-700",
  creating: "bg-amber-500/15 text-amber-700",
  created: "bg-emerald-600 text-white",
  skipped: "bg-muted text-muted-foreground",
  error: "bg-destructive text-destructive-foreground",
};

export default function AdminImport() {
  const [job, setJob] = useState<JobRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dryRun, setDryRun] = useState(false);
  const [includeExisting, setIncludeExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [fullCrawlBusy, setFullCrawlBusy] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState<string>("");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleBusy, setSingleBusy] = useState(false);
  const [singleResult, setSingleResult] = useState<SingleImportResult | null>(null);
  const tickRef = useRef<number | null>(null);

  const fetchAll = async () => {
    const [{ data: jobData }, { data: logData }] = await Promise.all([
      supabase.from("product_import_job" as never).select("*").eq("id", "singleton").maybeSingle(),
      supabase
        .from("product_import_log" as never)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);
    if (jobData) setJob(jobData as unknown as JobRow);
    if (logData) setLogs(logData as unknown as LogRow[]);

    // Per-status counts (separate query so we get accurate totals not capped at 50)
    const statuses = ["pending", "scraping", "scraped", "creating", "created", "error"];
    const next: Record<string, number> = {};
    for (const s of statuses) {
      const { count } = await supabase
        .from("product_import_log" as never)
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      next[s] = count ?? 0;
    }
    setCounts(next);
  };

  useEffect(() => {
    fetchAll();
    const interval = window.setInterval(fetchAll, 3000);
    return () => window.clearInterval(interval);
  }, []);

  // Auto-tick: while job state is "running", call the worker every 6s
  useEffect(() => {
    if (job?.state !== "running") {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    if (tickRef.current) return;
    const tick = async () => {
      try {
        await supabase.functions.invoke("product-import-run", {
          body: { batch_size: 2 },
        });
      } catch (err) {
        console.error("[admin-import] worker tick failed", err);
      }
    };
    tick();
    tickRef.current = window.setInterval(tick, 20000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [job?.state]);

  const runDiscover = async () => {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-import-discover", {
        body: { include_existing: includeExisting },
      });
      if (error) throw error;
      const newC = data?.new_count ?? 0;
      const updC = data?.update_count ?? 0;
      toast.success(`Entdeckung fertig: ${newC} neu, ${updC} Updates`);
      fetchAll();
    } catch (err) {
      toast.error(`Entdeckung fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setDiscovering(false);
    }
  };

  /** One-click full crawl: discover → start. Cron worker takes over from there. */
  const runFullCrawl = async () => {
    if (!confirm(
      `Voll-Import startet jetzt:\n\n` +
      `1. Scannt casamoda.com + venti.com komplett (Kategorien + Sitemap)\n` +
      `2. Legt neue Produkte in Shopify an\n` +
      `${includeExisting ? "3. Aktualisiert bestehende Produkte (Bilder/Preis/Beschreibung)\n" : ""}` +
      `\nDauer: ca. 2–4 Stunden. Du kannst die Seite zumachen, der Worker läuft im Hintergrund weiter.\n\nWeiter?`,
    )) return;

    setFullCrawlBusy(true);
    try {
      toast.info("Schritt 1/2: Entdecke Produkte auf casamoda.com + venti.com…");
      const { data: discData, error: discErr } = await supabase.functions.invoke(
        "product-import-discover",
        { body: { include_existing: includeExisting } },
      );
      if (discErr) throw discErr;
      const newC = discData?.new_count ?? 0;
      const updC = discData?.update_count ?? 0;
      const total = discData?.inserted ?? 0;
      if (total === 0) {
        toast.warning("Keine Produkte gefunden. Crawl wird nicht gestartet.");
        return;
      }
      toast.success(`${total} Produkte entdeckt (${newC} neu, ${updC} Update)`);

      toast.info("Schritt 2/2: Worker startet…");
      const { error: startErr } = await supabase.functions.invoke("product-import-control", {
        body: { action: "start", dry_run: false },
      });
      if (startErr) throw startErr;
      toast.success(`Voll-Import läuft! ${total} Produkte werden im Hintergrund verarbeitet.`);
      fetchAll();
    } catch (err) {
      toast.error(`Voll-Import fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setFullCrawlBusy(false);
    }
  };

  const runStart = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("product-import-control", {
        body: { action: "start", dry_run: dryRun },
      });
      if (error) throw error;
      toast.success(dryRun ? "Trockenlauf gestartet" : "Echter Import läuft");
      fetchAll();
    } catch (err) {
      toast.error(`Start fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const runStop = async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke("product-import-control", {
        body: { action: "stop" },
      });
      toast.info("Stop-Signal gesendet");
      fetchAll();
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    if (!confirm("Wirklich alle Logs löschen und Job zurücksetzen? (Bereits angelegte Shopify-Produkte werden NICHT gelöscht.)")) return;
    setBusy(true);
    try {
      await supabase.functions.invoke("product-import-control", {
        body: { action: "reset" },
      });
      toast.success("Zurückgesetzt");
      fetchAll();
    } finally {
      setBusy(false);
    }
  };

  const runSingleUrl = async (force = false) => {
    const url = singleUrl.trim();
    if (!url) {
      toast.error("Bitte URL einfügen");
      return;
    }
    if (!/casamoda\.com|venti\.com/.test(url)) {
      toast.error("Nur casamoda.com oder venti.com URLs werden unterstützt");
      return;
    }
    setSingleBusy(true);
    setSingleResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<SingleImportResult>(
        "product-import-by-url",
        { body: { url, force } },
      );
      // Edge function returns 409 with structured body for duplicates; supabase-js
      // surfaces non-2xx as `error`, but `data` may still be populated. Prefer data.
      const payload: SingleImportResult | null =
        (data as SingleImportResult | null) ??
        (error && typeof (error as { context?: unknown }).context === "object"
          ? null
          : null);

      if (payload?.already_exists) {
        setSingleResult(payload);
        toast.warning(
          `Existiert bereits: "${payload.title}" (${payload.matched_by === "handle" ? "Handle-Match" : "Artikelnummer-Match"})`,
        );
        return;
      }

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Unbekannter Fehler");
      setSingleResult(data);
      toast.success(
        data.action === "created"
          ? `Neu angelegt: ${data.title} (${data.colors_found} Farben)`
          : `Aktualisiert: ${data.title} (${data.colors_found} Farben)`,
      );
      setSingleUrl("");
      fetchAll();
    } catch (err) {
      const msg = (err as Error).message;
      setSingleResult({ success: false, error: msg });
      toast.error(`Import fehlgeschlagen: ${msg}`);
    } finally {
      setSingleBusy(false);
    }
  };

  const runPurgeShopify = async () => {
    const confirmText = prompt(
      "⚠️ Achtung: Löscht ALLE Produkte der Marken CASA MODA und VENTI direkt aus Shopify.\n\nTippe LÖSCHEN um zu bestätigen:",
    );
    if (confirmText !== "LÖSCHEN") {
      toast.info("Abgebrochen");
      return;
    }

    setPurging(true);
    setPurgeProgress("Starte…");
    let totalDeleted = 0;
    let totalFailed = 0;
    try {
      for (let round = 1; round <= 20; round++) {
        setPurgeProgress(`Runde ${round} läuft (bisher gelöscht: ${totalDeleted})…`);
        const { data, error } = await supabase.functions.invoke("product-import-cleanup", {
          body: { confirm: true, vendors: ["CASA MODA", "VENTI"], max: 200 },
        });
        if (error) throw error;
        const deleted = (data?.deleted as number) ?? 0;
        const failed = (data?.failed as number) ?? 0;
        const remaining = (data?.remaining_estimate as number) ?? 0;
        totalDeleted += deleted;
        totalFailed += failed;
        setPurgeProgress(
          `Runde ${round}: ${deleted} gelöscht (Total: ${totalDeleted}). Geschätzt verbleibend: ${remaining}`,
        );
        if (deleted === 0 && remaining === 0) break;
        if (deleted === 0 && failed === 0) break;
      }
      toast.success(
        `Purge fertig: ${totalDeleted} Produkte gelöscht${totalFailed > 0 ? `, ${totalFailed} Fehler` : ""}`,
      );
      setPurgeProgress(`Fertig: ${totalDeleted} gelöscht`);
    } catch (err) {
      toast.error(`Purge-Fehler: ${(err as Error).message}`);
      setPurgeProgress(`Fehler: ${(err as Error).message}`);
    } finally {
      setPurging(false);
    }
  };

  const isRunning = job?.state === "running";
  const isStopping = job?.state === "stopping";
  const progress = job && job.total > 0 ? (job.processed / job.total) * 100 : 0;

  return (
    <SiteLayout>
      <div className="container max-w-6xl py-12 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif">Produkt-Import</h1>
            <Badge variant="outline" className="font-mono text-xs">/admin/import</Badge>
          </div>
          <p className="text-muted-foreground">
            Importiert fehlende Casa-Moda- und Venti-Produkte autonom in Shopify. Bilder werden direkt von den Marken-CDNs zu Shopify übernommen.
          </p>
        </header>

        {/* HERO: One-click full crawl */}
        <Card className="p-6 space-y-4 border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/15 p-3 shrink-0">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-serif">Voll-Import: alles holen</h2>
              <p className="text-sm text-muted-foreground">
                Scannt <strong>casamoda.com</strong> + <strong>venti.com</strong> komplett (Kategorien + Sitemap),
                holt Bilder, Beschreibung, Material, Pflege, Preis und Farben — und legt jedes Produkt in Shopify an
                oder aktualisiert es. Worker läuft autonom im Hintergrund (~2–4h für ~800 Produkte).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="include-existing"
                  checked={includeExisting}
                  onCheckedChange={setIncludeExisting}
                  disabled={fullCrawlBusy || isRunning}
                />
                <Label htmlFor="include-existing" className="text-sm cursor-pointer">
                  Bestehende Produkte aktualisieren (Bilder/Preis/Beschreibung neu ziehen)
                </Label>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {!isRunning ? (
                <Button
                  size="lg"
                  onClick={runFullCrawl}
                  disabled={fullCrawlBusy || isRunning}
                  className="min-w-[180px]"
                >
                  {fullCrawlBusy ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Startet…</>
                  ) : (
                    <><Rocket className="h-5 w-5 mr-2" /> Voll-Import starten</>
                  )}
                </Button>
              ) : (
                <Button size="lg" variant="destructive" onClick={runStop} disabled={busy} className="min-w-[180px]">
                  <Square className="h-5 w-5 mr-2" /> Stoppen
                </Button>
              )}
            </div>
          </div>
          {(isRunning || isStopping) && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{job?.processed ?? 0} / {job?.total ?? 0} Produkte</span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {job?.message && (
                <p className="text-xs text-muted-foreground italic truncate">→ {job.message}</p>
              )}
            </div>
          )}
        </Card>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Hinweis:</strong> Der Cron-Worker stösst sich alle 60 Sekunden selbst an, solange ein Job läuft.
            Du kannst die Seite zumachen — der Import läuft im Hintergrund weiter und ist beim Wiederöffnen sichtbar.
          </AlertDescription>
        </Alert>

        {/* Single URL import — quickest path */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <div className="space-y-1">
            <h2 className="font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Einzelnes Produkt per URL importieren
            </h2>
            <p className="text-sm text-muted-foreground">
              Füge eine Casa Moda oder Venti Produkt-URL ein. Findet automatisch alle Farb-Varianten,
              zieht Beschreibung, Material, Pflegehinweise, Bilder und Preise und legt EIN Shopify-Produkt
              mit allen Farben + Grössen an. Existiert das Produkt bereits, wird es aktualisiert.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              placeholder="https://www.casamoda.com/de/de/businesshemd-3760-474"
              disabled={singleBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !singleBusy) runSingleUrl(false);
              }}
              className="flex-1"
            />
            <Button onClick={() => runSingleUrl(false)} disabled={singleBusy || !singleUrl.trim()}>
              {singleBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lädt… (30–90s)
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Importieren
                </>
              )}
            </Button>
          </div>
          {singleResult && singleResult.already_exists && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Produkt existiert bereits in Shopify
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <div>Titel: <span className="text-foreground">{singleResult.title}</span></div>
                <div>Handle: <span className="font-mono">{singleResult.handle}</span></div>
                <div>Shopify-ID: <span className="font-mono">{singleResult.shopify_product_id}</span></div>
                <div>
                  Erkannt über:{" "}
                  <span className="text-foreground">
                    {singleResult.matched_by === "handle" ? "Handle (URL)" : `Artikelnummer ${singleResult.article_number}`}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Es wurde nichts importiert. Wenn du das bestehende Produkt mit den aktuellen Daten von der Webseite überschreiben möchtest,
                klicke auf „Trotzdem überschreiben".
              </p>
              <div className="flex gap-2 flex-wrap">
                {singleResult.shopify_admin_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={singleResult.shopify_admin_url} target="_blank" rel="noopener noreferrer">
                      In Shopify Admin öffnen
                    </a>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runSingleUrl(true)}
                  disabled={singleBusy}
                >
                  {singleBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Trotzdem überschreiben
                </Button>
              </div>
            </div>
          )}
          {singleResult && singleResult.success && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {singleResult.action === "created" ? "Neu angelegt" : "Aktualisiert"}: {singleResult.title}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <div>Handle: <span className="font-mono">{singleResult.handle}</span></div>
                <div>Shopify-ID: <span className="font-mono">{singleResult.shopify_product_id}</span></div>
                <div>{singleResult.colors_found} Farben: <span className="text-foreground">{singleResult.colors?.join(", ")}</span></div>
                <div>{singleResult.sizes?.length} Grössen · {singleResult.images_uploaded} Bilder</div>
                {singleResult.price_eur != null && (
                  <div>
                    Preis: <span className="text-foreground">€{singleResult.price_eur}</span>
                    {singleResult.compare_at_price_eur && (
                      <span className="line-through ml-2">€{singleResult.compare_at_price_eur}</span>
                    )}
                  </div>
                )}
                {singleResult.fit && <div>Passform: <span className="text-foreground">{singleResult.fit}</span></div>}
                {singleResult.is_new && <div>Badge: <span className="text-foreground">NEU</span></div>}
                {singleResult.article_number && <div>Artikelnr: <span className="font-mono">{singleResult.article_number}</span></div>}
                {singleResult.material && <div>Material: <span className="text-foreground">{singleResult.material}</span></div>}
                {(singleResult.description_length ?? 0) > 0 && (
                  <div>Beschreibung: <span className="text-foreground">{singleResult.description_length} Zeichen</span></div>
                )}
                {(singleResult.features_count ?? 0) > 0 && (
                  <div>Features: <span className="text-foreground">{singleResult.features_count} Bullets</span></div>
                )}
                {(singleResult.care_count ?? 0) > 0 && (
                  <div>Pflege: <span className="text-foreground">{singleResult.care_count} Symbole</span></div>
                )}
              </div>

              {singleResult.missing_fields && singleResult.missing_fields.length > 0 && (
                <div className="border-t border-emerald-500/30 pt-3 space-y-1">
                  <p className="text-xs font-medium text-amber-700">
                    ⚠ Konnte nicht von der Webseite geholt werden — bitte in Shopify nachpflegen:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {singleResult.missing_fields.map((f) => (
                      <Badge key={f} variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/40 text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {singleResult.look_generation_triggered && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <p className="font-medium text-primary">✨ Look-Vorschläge werden im Hintergrund generiert</p>
                  <p className="mt-1 text-muted-foreground">
                    In ca. 30–60&nbsp;Sek. unter{" "}
                    <a href="/admin/looks" className="text-primary underline hover:no-underline">/admin/looks</a>{" "}
                    im Tab „Drafts" prüfen und freigeben.
                  </p>
                </div>
              )}

              {singleResult.shopify_admin_url && (
                <a
                  href={singleResult.shopify_admin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-primary hover:underline"
                >
                  → In Shopify Admin öffnen
                </a>
              )}
            </div>
          )}
          {singleResult && !singleResult.success && !singleResult.already_exists && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {singleResult.error}
            </div>
          )}
        </Card>

        {/* Shopify purge card — destructive operation */}
        <Card className="p-6 space-y-3 border-destructive/40 bg-destructive/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="font-medium flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Shopify komplett purgen
              </h2>
              <p className="text-sm text-muted-foreground">
                Löscht ALLE CASA MODA + VENTI Produkte direkt aus Shopify (per Vendor-Suche, paginiert).
                Nutze dies vor einem sauberen Re-Import um Duplikate zu vermeiden.
              </p>
              {purgeProgress && (
                <p className="text-xs font-mono text-muted-foreground border-l-2 border-destructive/50 pl-2 mt-2">
                  {purgeProgress}
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={runPurgeShopify}
              disabled={purging || isRunning}
            >
              {purging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Alle löschen
            </Button>
          </div>
        </Card>

        {/* Job state card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={isRunning ? "default" : "outline"}>
                {job?.state ?? "—"}
              </Badge>
              {job?.dry_run && <Badge variant="secondary">Trockenlauf</Badge>}
              {(isRunning || isStopping) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-3">
                <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} disabled={isRunning} />
                <Label htmlFor="dry-run" className="text-sm">Trockenlauf</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runDiscover}
                disabled={discovering || isRunning}
              >
                {discovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Entdecken
              </Button>
              {!isRunning ? (
                <Button onClick={runStart} disabled={busy || isStopping || (job?.total ?? 0) === 0} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={runStop} disabled={busy}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={runReset} disabled={busy || isRunning}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Stat label="Total" value={job?.total ?? 0} />
            <Stat label="Verarbeitet" value={job?.processed ?? 0} />
            <Stat label="Erstellt" value={job?.created_count ?? 0} accent="emerald" />
            <Stat label="Fehler" value={job?.error_count ?? 0} accent="destructive" />
            <Stat label="Pending" value={counts.pending ?? 0} />
          </div>

          {job?.message && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              {job.message} · letzter Stand: {new Date(job.updated_at).toLocaleTimeString()}
            </p>
          )}
        </Card>

        {/* Per-status counters */}
        <Card className="p-6 space-y-3">
          <h2 className="font-medium">Status-Übersicht</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([status, count]) => (
              <Badge key={status} variant="outline" className={`${STATUS_COLORS[status] ?? ""}`}>
                {status}: {count}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-6 space-y-3">
          <h2 className="font-medium">Letzte Aktivität (50)</h2>
          <ScrollArea className="h-[480px]">
            <div className="space-y-2">
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Noch nichts. Klicke auf "Entdecken" um zu starten.</p>
              )}
              {logs.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 p-3 rounded-md border bg-card text-sm"
                >
                  <Badge className={`${STATUS_COLORS[row.status] ?? "bg-muted"} shrink-0 mt-0.5`}>
                    {row.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {row.scraped_data?.title || row.handle || "—"}
                      </span>
                      <Badge variant="outline" className="text-xs">{row.brand}</Badge>
                      {row.scraped_data?.price_eur && (
                        <Badge variant="secondary" className="text-xs">
                          €{row.scraped_data.price_eur}
                        </Badge>
                      )}
                      {row.scraped_data?.sizes && row.scraped_data.sizes.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {row.scraped_data.sizes.length} Grössen
                        </span>
                      )}
                      {row.scraped_data?.image_urls && (
                        <span className="text-xs text-muted-foreground">
                          {row.scraped_data.image_urls.length} Bilder
                        </span>
                      )}
                    </div>
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline truncate block"
                    >
                      {row.source_url}
                    </a>
                    {row.error_message && (
                      <p className="text-xs text-destructive mt-1">{row.error_message}</p>
                    )}
                    {row.shopify_product_id && (
                      <p className="text-xs text-emerald-700 mt-1">
                        ✓ Shopify-ID: {row.shopify_product_id}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(row.updated_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </SiteLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "destructive" }) {
  const colorClass =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}
