import { useState } from "react";
import { BookOpen, Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const categories = [
  { value: "methodology", label: "Méthodologie plan de compte" },
  { value: "template", label: "Template de message" },
  { value: "angle", label: "Angle d'attaque par secteur" },
  { value: "matrix", label: "Matrice de qualification" },
  { value: "best_practice", label: "Best practice commerciale" },
];

export default function KnowledgeBase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("methodology");
  const [saving, setSaving] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["rag_documents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rag_documents")
        .select("id, title, category, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; title: string; category: string; created_at: string }[];
    },
  });

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Champs requis", description: "Titre et contenu sont obligatoires." });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("rag_documents").insert({
      title: title.trim(),
      content: content.trim(),
      category,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      metadata: { added_manually: true },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le document.", variant: "destructive" });
    } else {
      toast({ title: "Document ajouté", description: `"${title}" a été ajouté à la base de connaissances.` });
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["rag_documents"] });
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const q = (supabase as any).from("rag_documents").delete().eq("id", id);
    const { error } = userId ? await q.eq("user_id", userId) : await q;
    if (!error) {
      toast({ title: "Supprimé", description: `"${docTitle}" a été supprimé.` });
      queryClient.invalidateQueries({ queryKey: ["rag_documents"] });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Base de connaissances ESN</h1>
      </div>

      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Ajouter un document</h3>
          <p className="text-xs text-muted-foreground">
            Ces documents seront utilisés par l&apos;IA pour personnaliser les analyses, les angles d&apos;attaque et les messages.
          </p>
          <Input placeholder="Titre du document" value={title} onChange={e => setTitle(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Collez ici votre contenu : méthodologie, template de message, grille d'analyse, angles par secteur, best practices..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
          />
          <Button onClick={handleAdd} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Ajout en cours..." : "Ajouter à la base"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{documents.length} document{documents.length !== 1 ? "s" : ""} dans la base</h3>
        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun document pour l&apos;instant.</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Ajoutez une méthodologie, un template de message ou des angles par secteur : l&apos;IA s&apos;en servira pour personnaliser vos analyses et vos messages.</p>
            <p className="text-xs text-muted-foreground mt-3">Utilisez le formulaire ci-dessus pour ajouter votre premier document.</p>
          </div>
        ) : documents.map((doc: { id: string; title: string; category: string; created_at: string }) => (
          <Card key={doc.id} className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {categories.find(c => c.value === doc.category)?.label || doc.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(doc.id, doc.title)}>
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
