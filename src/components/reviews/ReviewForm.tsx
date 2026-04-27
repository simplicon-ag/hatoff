import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RatingStars } from "./RatingStars";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const schema = z.object({
  reviewer_name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60, "Maximal 60 Zeichen"),
  rating: z.number().int().min(1, "Bitte Sterne wählen").max(5),
  title: z.string().trim().min(3, "Mindestens 3 Zeichen").max(80, "Maximal 80 Zeichen"),
  body: z.string().trim().min(30, "Mindestens 30 Zeichen").max(1000, "Maximal 1000 Zeichen"),
  size_purchased: z.string().optional(),
  size_fit: z.enum(["small", "true", "large"]).optional(),
  would_recommend: z.boolean(),
});

interface ReviewFormProps {
  productHandle: string;
  productTitle: string;
  sizeOptions?: string[];
  defaultName?: string;
  onSubmitted?: () => void;
  trigger?: React.ReactNode;
}

export const ReviewForm = ({
  productHandle,
  productTitle,
  sizeOptions = [],
  defaultName,
  onSubmitted,
  trigger,
}: ReviewFormProps) => {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewerName, setReviewerName] = useState(defaultName ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sizePurchased, setSizePurchased] = useState<string>("");
  const [sizeFit, setSizeFit] = useState<"small" | "true" | "large" | "">("");
  const [recommend, setRecommend] = useState(true);

  const reset = () => {
    setRating(0);
    setReviewerName(defaultName ?? "");
    setTitle("");
    setBody("");
    setSizePurchased("");
    setSizeFit("");
    setRecommend(true);
  };

  const handleSubmit = async () => {
    const parsed = schema.safeParse({
      reviewer_name: reviewerName,
      rating,
      title,
      body,
      size_purchased: sizePurchased || undefined,
      size_fit: sizeFit || undefined,
      would_recommend: recommend,
    });

    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast.error(first?.message ?? "Bitte Eingaben prüfen");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("review-submit", {
      body: { product_handle: productHandle, ...parsed.data },
    });
    setSubmitting(false);

    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error ?? error?.message ?? "Fehler beim Senden";
      toast.error(msg);
      return;
    }

    toast.success("Danke für deine Bewertung!");
    reset();
    setOpen(false);
    onSubmitted?.();
  };

  if (!authLoading && !user) {
    return (
      <Button asChild variant="outline">
        <Link to={`/auth?next=${encodeURIComponent(window.location.pathname)}`}>
          Anmelden, um zu bewerten
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline">Bewertung schreiben</Button>}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Bewertung schreiben</DialogTitle>
          <DialogDescription className="text-xs">
            Du bewertest <span className="font-medium text-foreground">{productTitle}</span>. Wir prüfen jede
            Bewertung gegen unsere Bestellhistorie — nur verifizierte Käufer:innen werden veröffentlicht.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <Label className="text-xs uppercase tracking-wide">Sterne</Label>
            <div className="mt-1.5">
              <RatingStars value={rating} size="lg" interactive onChange={setRating} />
            </div>
          </div>

          <div>
            <Label htmlFor="rev-name" className="text-xs uppercase tracking-wide">Dein Name</Label>
            <Input
              id="rev-name"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              maxLength={60}
              placeholder="z.B. Marc K."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="rev-title" className="text-xs uppercase tracking-wide">Titel</Label>
            <Input
              id="rev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Kurze Headline"
              className="mt-1.5"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{title.length}/80</p>
          </div>

          <div>
            <Label htmlFor="rev-body" className="text-xs uppercase tracking-wide">Deine Bewertung</Label>
            <Textarea
              id="rev-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder="Wie ist die Qualität, der Schnitt, der Tragekomfort?"
              rows={5}
              className="mt-1.5"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{body.length}/1000 (mind. 30)</p>
          </div>

          {sizeOptions.length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wide">Gekaufte Grösse</Label>
              <Select value={sizePurchased} onValueChange={setSizePurchased}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wide">Passform</Label>
            <RadioGroup
              value={sizeFit}
              onValueChange={(v) => setSizeFit(v as "small" | "true" | "large")}
              className="mt-2 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="small" id="fit-s" />
                <Label htmlFor="fit-s" className="text-sm font-normal">Fällt klein aus</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="true" id="fit-t" />
                <Label htmlFor="fit-t" className="text-sm font-normal">Passt genau</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="large" id="fit-l" />
                <Label htmlFor="fit-l" className="text-sm font-normal">Fällt gross aus</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
            <Label htmlFor="rev-rec" className="text-sm font-normal cursor-pointer">
              Würdest du dieses Produkt weiterempfehlen?
            </Label>
            <Switch id="rev-rec" checked={recommend} onCheckedChange={setRecommend} />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bewertung senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
