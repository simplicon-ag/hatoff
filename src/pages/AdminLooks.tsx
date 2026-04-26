import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw, Trash2, Sparkles, Save, ImageIcon, Plus } from "lucide-react";
import type { DbLookRow } from "@/hooks/useCuratedLooks";

type Look = DbLookRow;

const WELT_OPTIONS = ["business", "hemden", "jacken", "sommer", "freizeit", "abend"];

export default function AdminLooks() {
  const [drafts, setDrafts] = useState<Look[]>([]);
  const [published, setPublished] = useState<Look[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Manual create
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubtitle, setManualSubtitle] = useState("");
  const [manualWelt, setManualWelt] = useState("hemden");
  const [manualHandles, setManualHandles] = useState("");
  const [manualStory, setManualStory] = useState("");

  // Single-handle look generation
  const [singleHandle, setSingleHandle] = useState("");
  const [singleBusy, setSingleBusy] = useState(false);

  // Backfill
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState({ done: 0, total: 0 });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("curated_looks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Looks konnten nicht geladen werden");
    } else {
      const all = (data ?? []) as Look[];
      setDrafts(all.filter((l) => l.status === "draft"));
      setPublished(all.filter((l) => l.status === "published"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("look-admin", { body });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data;
  };

  const publish = async (id: string) => {
    setBusyId(id);
    try {
      await callAdmin({ action: "publish", id });
      toast.success("Look veröffentlicht");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusyId(null); }
  };

  const unpublish = async (id: string) => {
    setBusyId(id);
    try { await callAdmin({ action: "unpublish", id }); toast.success("Zurück in Drafts"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("Look wirklich löschen?")) return;
    setBusyId(id);
    try { await callAdmin({ action: "delete", id }); toast.success("Gelöscht"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusyId(null); }
  };

  const regenerateHero = async (id: string) => {
    setBusyId(id);
    try {
      await callAdmin({ action: "regenerate_hero", id });
      toast.success("Neues Hero-Bild generiert");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusyId(null); }
  };

  const saveEdit = async (id: string, patch: Partial<Look>) => {
    setBusyId(id);
    try { await callAdmin({ action: "update", id, patch }); toast.success("Gespeichert"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusyId(null); }
  };

  const createManual = async () => {
    const handles = manualHandles.split(",").map((h) => h.trim()).filter(Boolean);
    if (!manualTitle || handles.length < 2) {
      toast.error("Titel und mindestens 2 Produkt-Handles nötig");
      return;
    }
    try {
      await callAdmin({
        action: "create_manual",
        look: { title: manualTitle, subtitle: manualSubtitle, welt: manualWelt, product_handles: handles, story: manualStory },
      });
      toast.success("Look erstellt (als Draft)");
      setManualTitle(""); setManualSubtitle(""); setManualHandles(""); setManualStory("");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
  };

  const generateForHandle = async () => {
    const h = singleHandle.trim();
    if (!h) {
      toast.error("Bitte einen Produkt-Handle eingeben");
      return;
    }
    setSingleBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("look-generate", {
        body: { productHandle: h, force: true },
      });
      if (error) throw new Error(error.message);
      const created = (data as { created?: number; reason?: string })?.created ?? 0;
      const reason = (data as { reason?: string })?.reason;
      if (created > 0) {
        toast.success(`${created} neue Look-Draft(s) für "${h}" erstellt`);
        setSingleHandle("");
        refresh();
      } else {
        toast.warning(`Keine neuen Looks erzeugt${reason ? `: ${reason}` : ""}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Look-Generierung fehlgeschlagen");
    } finally {
      setSingleBusy(false);
    }
  };

  const runBackfill = async () => {
    if (!confirm("Looks für ALLE Produkte ohne Anker-Look generieren? Das kann mehrere Minuten dauern und verbraucht AI-Credits.")) return;
    setBackfilling(true);
    try {
      // Fetch all product handles via existing import_log
      const { data: logRows } = await supabase
        .from("product_import_log")
        .select("handle, status")
        .eq("status", "ok")
        .not("handle", "is", null);
      const allHandles = Array.from(new Set((logRows ?? []).map((r) => r.handle as string).filter(Boolean)));

      const { data: existing } = await supabase
        .from("curated_looks")
        .select("anchor_handle");
      const haveAnchor = new Set((existing ?? []).map((r) => r.anchor_handle).filter(Boolean));
      const todo = allHandles.filter((h) => !haveAnchor.has(h));

      setBackfillProgress({ done: 0, total: todo.length });
      for (let i = 0; i < todo.length; i++) {
        try {
          await supabase.functions.invoke("look-generate", { body: { productHandle: todo[i] } });
        } catch (e) {
          console.warn("backfill failed for", todo[i], e);
        }
        setBackfillProgress({ done: i + 1, total: todo.length });
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.success(`Backfill fertig — ${todo.length} Produkte verarbeitet`);
      refresh();
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container-editorial py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Admin</p>
            <h1 className="mt-2 font-display text-4xl">Looks-Verwaltung</h1>
            <p className="mt-2 text-muted-foreground">
              KI-Vorschläge prüfen, freigeben oder selbst Looks anlegen.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Neu laden
            </Button>
            <Button onClick={runBackfill} disabled={backfilling}>
              <Sparkles className="mr-2 h-4 w-4" />
              {backfilling ? `Generiere… ${backfillProgress.done}/${backfillProgress.total}` : "Backfill: alle Bestandsprodukte"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="drafts" className="mt-8">
          <TabsList>
            <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
            <TabsTrigger value="published">Veröffentlicht ({published.length})</TabsTrigger>
            <TabsTrigger value="manual">Manuell erstellen</TabsTrigger>
          </TabsList>

          <TabsContent value="drafts" className="mt-6">
            {drafts.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Keine Drafts. Importiere Produkte oder starte Backfill.</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {drafts.map((look) => (
                  <DraftCard
                    key={look.id} look={look} busy={busyId === look.id}
                    onPublish={() => publish(look.id)}
                    onReject={() => remove(look.id)}
                    onRegenHero={() => regenerateHero(look.id)}
                    onSave={(patch) => saveEdit(look.id, patch)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="published" className="mt-6">
            {published.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Noch nichts veröffentlicht.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {published.map((look) => (
                  <Card key={look.id} className="overflow-hidden">
                    {look.hero_image_url && (
                      <img src={look.hero_image_url} alt={look.title} className="aspect-[4/5] w-full object-cover" />
                    )}
                    <div className="p-4">
                      <Badge variant="secondary" className="mb-2">{look.welt ?? "—"}</Badge>
                      <h3 className="font-display text-xl">{look.title}</h3>
                      <p className="text-sm text-muted-foreground">{look.subtitle}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => unpublish(look.id)} disabled={busyId === look.id}>
                          Zurückziehen
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(look.id)} disabled={busyId === look.id}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <Card className="max-w-2xl p-6">
              <h2 className="font-display text-2xl">Neuen Look manuell anlegen</h2>
              <p className="mt-1 text-sm text-muted-foreground">Wird als Draft gespeichert. Hero-Bild kannst du danach generieren lassen.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <Label>Titel</Label>
                  <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="z.B. Smart Casual am Café" />
                </div>
                <div>
                  <Label>Untertitel</Label>
                  <Input value={manualSubtitle} onChange={(e) => setManualSubtitle(e.target.value)} placeholder="Locker, aber nie nachlässig." />
                </div>
                <div>
                  <Label>Welt</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={manualWelt} onChange={(e) => setManualWelt(e.target.value)}>
                    {WELT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Produkt-Handles (komma-getrennt, Anker zuerst)</Label>
                  <Input value={manualHandles} onChange={(e) => setManualHandles(e.target.value)} placeholder="venti-businesshemd-..., casa-moda-chinohose-..." />
                </div>
                <div>
                  <Label>Story</Label>
                  <Textarea value={manualStory} onChange={(e) => setManualStory(e.target.value)} rows={4} />
                </div>
                <Button onClick={createManual}><Plus className="mr-2 h-4 w-4" />Look anlegen</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </SiteLayout>
  );
}

function DraftCard({
  look, busy, onPublish, onReject, onRegenHero, onSave,
}: {
  look: Look;
  busy: boolean;
  onPublish: () => void;
  onReject: () => void;
  onRegenHero: () => void;
  onSave: (patch: Partial<Look>) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(look.title);
  const [subtitle, setSubtitle] = useState(look.subtitle ?? "");
  const [story, setStory] = useState(look.story ?? "");

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/5] w-full bg-secondary">
        {look.hero_image_url ? (
          <img src={look.hero_image_url} alt={look.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 opacity-30" />
          </div>
        )}
        <Badge className="absolute left-3 top-3" variant="secondary">{look.welt ?? "—"}</Badge>
      </div>
      <div className="space-y-3 p-4">
        {edit ? (
          <>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            <Textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} />
          </>
        ) : (
          <>
            <h3 className="font-display text-xl leading-tight">{look.title}</h3>
            <p className="text-sm text-muted-foreground">{look.subtitle}</p>
            {look.story && <p className="text-xs text-muted-foreground line-clamp-3">{look.story}</p>}
          </>
        )}
        <div className="text-xs text-muted-foreground">
          <strong>Stücke:</strong> {look.product_handles.join(", ")}
        </div>
        {look.highlights?.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {look.highlights.map((h, i) => <li key={i}>• {h}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {edit ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => { onSave({ title, subtitle, story }); setEdit(false); }}>
                <Save className="mr-1 h-4 w-4" /> Speichern
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Abbrechen</Button>
            </>
          ) : (
            <>
              <Button size="sm" disabled={busy} onClick={onPublish}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Freigeben</>}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEdit(true)}>Bearbeiten</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onRegenHero}>
                <RefreshCw className="mr-1 h-4 w-4" /> Bild
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
                <X className="mr-1 h-4 w-4" /> Verwerfen
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
