import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useClubPoints, usePointsHistory } from "@/hooks/useClubPoints";
import { CLUB_TIERS } from "@/lib/club-tiers";
import { TierCard } from "@/components/club/TierCard";
import { PointsBalance } from "@/components/club/PointsBalance";
import { PointsHistory } from "@/components/club/PointsHistory";

const ClubAccount = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const points = useClubPoints(userId);
  const history = usePointsHistory(userId);

  // Profile
  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, birthday")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { display_name: "", birthday: null as string | null };
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    document.title = "Mein Konto · HATOFF Club";
  }, []);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.display_name ?? "");
      setBirthday(profile.data.birthday ?? "");
    }
  }, [profile.data]);

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: displayName || null,
      birthday: birthday || null,
    });
    setSavingProfile(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Profil aktualisiert");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const handleDemoGrant = async () => {
    setGranting(true);
    const { error } = await supabase.rpc("add_club_points", {
      _points: 50,
      _reason: "demo_grant",
      _meta: {},
    });
    setGranting(false);
    if (error) {
      toast.error("Demo-Gutschrift fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("+50 Punkte gutgeschrieben");
    qc.invalidateQueries({ queryKey: ["club-points", userId] });
    qc.invalidateQueries({ queryKey: ["club-points-history", userId] });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code kopiert", { description: code });
  };

  const greetingName = profile.data?.display_name || user?.email?.split("@")[0] || "Stil-Liebhaber";

  return (
    <SiteLayout>
      {/* Hero band */}
      <section className="bg-secondary/30">
        <div className="container-editorial py-12 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">HATOFF Club</p>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">Hallo, {greetingName}.</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Schön, dich zu sehen. Hier ist dein Stil-Konto.
              </p>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="text-sm">
              <LogOut className="h-4 w-4" /> Abmelden
            </Button>
          </div>
        </div>
      </section>

      <section className="container-editorial py-12 md:py-16">
        {/* Balance */}
        {points.data ? (
          <PointsBalance
            points={points.data.points}
            tier={points.data.tier}
            next={points.data.next}
            progress={points.data.progress}
          />
        ) : (
          <div className="h-48 animate-pulse border border-border bg-card" />
        )}

        {/* Discount code */}
        {points.data && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                Dein persönlicher Rabattcode
              </p>
              <p className="mt-2 font-display text-2xl tracking-wider">{points.data.tier.code}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {points.data.tier.discountPercent}% auf alle Bestellungen · einlösbar im Checkout
              </p>
            </div>
            <Button variant="outline" onClick={() => copyCode(points.data!.tier.code)}>
              <Copy className="h-4 w-4" /> Code kopieren
            </Button>
          </div>
        )}

        {/* Tier overview */}
        <div className="mt-14">
          <h2 className="font-display text-2xl md:text-3xl">Deine Stufen</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {CLUB_TIERS.map((t) => {
              const reached = (points.data?.points ?? 0) >= t.threshold;
              const current = points.data?.tier.key === t.key;
              return <TierCard key={t.key} tier={t} current={current} reached={reached} />;
            })}
          </div>
        </div>

        {/* Two-column: history + profile */}
        <div className="mt-14 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl md:text-3xl">Punkte-Historie</h2>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                Letzte 30 Bewegungen
              </Badge>
            </div>
            {history.isLoading ? (
              <div className="h-48 animate-pulse border border-border bg-card" />
            ) : (
              <PointsHistory entries={history.data ?? []} />
            )}

            {/* Demo grant */}
            <div className="mt-6 flex items-start gap-3 border border-dashed border-border bg-secondary/30 p-5">
              <Sparkles className="mt-0.5 h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">Demo: 50 Punkte gutschreiben</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Für Testzwecke — sobald die Bestell-Anbindung steht, werden Punkte automatisch
                  pro CHF Umsatz gutgeschrieben.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleDemoGrant} disabled={granting}>
                {granting ? "…" : "+50 Punkte"}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl md:text-3xl">Dein Profil</h2>
            <div className="mt-5 space-y-4 border border-border bg-card p-6">
              <div>
                <Label htmlFor="display-name">Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="birthday">Geburtstag (für Geschenke)</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday ?? ""}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                E-Mail: <span className="text-foreground">{user?.email}</span>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                {savingProfile ? "Speichere…" : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default ClubAccount;
