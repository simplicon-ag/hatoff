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
import { AlertTriangle, Loader2, Play, RefreshCw, Square, Search, Trash2, Link2, CheckCircle2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";

type SingleImportResult = {
  success: boolean;
  action?: "created" | "updated";
  shopify_product_id?: string;
  handle?: string;
  title?: string;
  colors_found?: number;
  colors?: string[];
  sizes?: string[];
  images_uploaded?: number;
  price_eur?: number | null;
  material?: string;
  article_number?: string;
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
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState<string>("");
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
      const { data, error } = await supabase.functions.invoke("product-import-discover");
      if (error) throw error;
      toast.success(`Entdeckung fertig: ${data?.inserted ?? 0} gruppierte Produkte (Farben werden zu Varianten)`);
      fetchAll();
    } catch (err) {
      toast.error(`Entdeckung fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setDiscovering(false);
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

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Workflow:</strong> 1️⃣ <em>Entdecken</em> findet alle fehlenden Produkte. 2️⃣ <em>Trockenlauf</em> scrapt &amp; prüft die Daten ohne in Shopify zu schreiben. 3️⃣ Echter Import nur, wenn der Trockenlauf sauber aussieht.
          </AlertDescription>
        </Alert>

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
