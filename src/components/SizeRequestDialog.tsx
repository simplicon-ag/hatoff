import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  productHandle: string;
  productTitle?: string;
  brand?: string;
  color?: string;
  parentArticleId?: string;
  availableSizes: string[]; // for select; soldout/missing flagged separately
  soldOutSizes?: string[];
  trigger?: React.ReactNode;
  defaultSize?: string;
};

export default function SizeRequestDialog({
  productHandle,
  productTitle,
  brand,
  color,
  parentArticleId,
  availableSizes,
  soldOutSizes = [],
  trigger,
  defaultSize,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [size, setSize] = useState(defaultSize ?? "");
  const [message, setMessage] = useState("");

  // Vollständige Standard-Größenpalette für Herrenoberteile/Hemden (Casa Moda, Venti)
  // Numerische Kragenweiten + Buchstabengrössen, damit Kunden auch nicht-gelistete Grössen anfragen können.
  const STANDARD_SIZES = [
    "37/38", "39/40", "41/42", "43/44", "45/46", "47/48",
    "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL",
  ];

  // De-duplicate: alle Standard-Grössen + tatsächliche Varianten (verfügbar / ausverkauft)
  const sizeSet = new Map<string, "available" | "soldout" | "unlisted">();
  for (const s of STANDARD_SIZES) sizeSet.set(s, "unlisted");
  for (const s of soldOutSizes) sizeSet.set(s, "soldout");
  for (const s of availableSizes) sizeSet.set(s, "available");
  const sizes = Array.from(sizeSet.entries());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!size || !name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("size_requests").insert({
        product_handle: productHandle,
        product_title: productTitle ?? null,
        parent_article_id: parentArticleId ?? null,
        brand: brand ?? null,
        color: color ?? null,
        requested_size: size,
        customer_name: name.trim(),
        customer_email: email.trim(),
        message: message.trim() || null,
        user_id: userData.user?.id ?? null,
        status: "new",
      });
      if (error) throw error;
      toast({
        title: "Anfrage gesendet",
        description:
          "Wir prüfen die Verfügbarkeit und melden uns per E-Mail bei dir.",
      });
      setOpen(false);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({
        title: "Anfrage fehlgeschlagen",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Grösse nicht dabei? Anfragen
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grösse anfragen</DialogTitle>
          <DialogDescription>
            Sag uns welche Grösse du suchst. Wir prüfen die Verfügbarkeit beim
            Hersteller und melden uns per E-Mail bei dir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sr-size">Gewünschte Grösse</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger id="sr-size">
                <SelectValue placeholder="Grösse wählen" />
              </SelectTrigger>
              <SelectContent>
                {sizes.length === 0 && (
                  <SelectItem value="__keine__" disabled>
                    Keine Grössen verfügbar
                  </SelectItem>
                )}
                {sizes.map(([s, state]) => (
                  <SelectItem key={s} value={s}>
                    {s}
                    {state === "soldout" ? " (ausverkauft)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sr-name">Name</Label>
              <Input
                id="sr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vor- und Nachname"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sr-email">E-Mail</Label>
              <Input
                id="sr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-msg">
              Nachricht <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="sr-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="z.B. bevorzugte Lieferzeit, Alternativen erlaubt …"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !size || !name.trim() || !email.trim()}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Anfrage senden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
