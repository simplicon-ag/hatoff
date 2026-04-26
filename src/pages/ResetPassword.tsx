import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Neues Passwort · HATOFF Club";
    // Supabase exchanges the recovery token in the URL hash on load
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Passwort aktualisiert");
    navigate("/club/mein-konto", { replace: true });
  };

  return (
    <SiteLayout>
      <div className="container-editorial flex min-h-[70vh] items-center justify-center py-16">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md space-y-4 rounded-md border border-border bg-card p-6"
        >
          <h1 className="font-display text-2xl">Neues Passwort setzen</h1>
          <p className="text-sm text-muted-foreground">
            {ready
              ? "Wähle ein neues Passwort für dein Konto."
              : "Reset-Link wird verarbeitet…"}
          </p>
          <div>
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || submitting}>
            {submitting ? "Speichere…" : "Passwort speichern"}
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
};

export default ResetPassword;
