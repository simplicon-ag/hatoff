import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/club/mein-konto";
  const { user, loading } = useAuth();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    document.title = "Anmelden · HATOFF Club";
  }, []);

  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true });
  }, [user, loading, navigate, redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Anmeldung fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Willkommen zurück");
    navigate(redirect, { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${redirect}`,
        data: { display_name: displayName },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Registrierung fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Konto erstellt", {
      description: "Bitte bestätige deine E-Mail-Adresse, um loszulegen.",
    });
    setTab("login");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Versand fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("E-Mail gesendet", { description: "Schau in dein Postfach für den Reset-Link." });
    setResetMode(false);
  };

  return (
    <SiteLayout>
      <div className="container-editorial flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">HATOFF Club</p>
            <h1 className="mt-3 font-display text-3xl md:text-4xl">
              {resetMode ? "Passwort zurücksetzen" : "Mitgliederbereich"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {resetMode
                ? "Wir senden dir einen Link per E-Mail."
                : "Anmelden oder kostenlos beitreten — Stil wird belohnt."}
            </p>
          </div>

          {resetMode ? (
            <form onSubmit={handleReset} className="space-y-4 rounded-md border border-border bg-card p-6">
              <div>
                <Label htmlFor="reset-email">E-Mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sende…" : "Reset-Link senden"}
              </Button>
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Zurück zur Anmeldung
              </button>
            </form>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Anmelden</TabsTrigger>
                <TabsTrigger value="signup">Registrieren</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-4 rounded-md border border-border bg-card p-6">
                  <div>
                    <Label htmlFor="login-email">E-Mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Anmelden…" : "Anmelden"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Passwort vergessen?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="mt-4 space-y-4 rounded-md border border-border bg-card p-6">
                  <div>
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="mt-1.5"
                      placeholder="Wie sollen wir dich nennen?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">E-Mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Passwort</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Erstelle…" : "Kostenlos beitreten"}
                  </Button>
                  <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    100 Willkommens-Punkte · Jederzeit kündbar
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Mehr erfahren über den{" "}
            <Link to="/club" className="underline underline-offset-4 hover:text-foreground">
              HATOFF Club
            </Link>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
};

export default Auth;
