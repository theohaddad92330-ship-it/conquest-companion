import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Plus, X, Info, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile: dbProfile, loading: profileLoading, updateProfile } = useProfile();
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState({
    esnName: "",
    size: "",
    offers: [] as string[],
    sectors: [] as string[],
    clientType: [] as string[],
    personas: [] as string[],
    geo: [] as string[],
    existingRefs: [] as string[],
    bench: [] as string[],
    style: "direct",
    references: [] as string[],
    excludedPersonas: [] as string[],
    salesCycle: "",
    avgTJM: "",
    salesTeamSize: "",
    mainChallenge: "",
  });
  const [newBench, setNewBench] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newExcluded, setNewExcluded] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dbProfile?.onboarding_data) {
      const data = dbProfile.onboarding_data as Record<string, unknown>;
      setProfile({
        esnName: (data.esnName as string) || "",
        size: (data.size as string) || "",
        offers: (data.offers as string[]) || [],
        sectors: (data.sectors as string[]) || [],
        clientType: (data.clientType as string[]) || [],
        personas: (data.personas as string[]) || [],
        geo: (data.geo as string[]) || [],
        existingRefs: (data.existingRefs as string[]) || [],
        bench: (data.bench as string[]) || [],
        style: (data.style as string) || "direct",
        references: (data.references as string[]) || [],
        excludedPersonas: (data.excludedPersonas as string[]) || [],
        salesCycle: (data.salesCycle as string) || "",
        avgTJM: (data.avgTJM as string) || "",
        salesTeamSize: (data.salesTeamSize as string) || "",
        mainChallenge: (data.mainChallenge as string) || "",
      });
    }
  }, [dbProfile]);

  const handleSave = async () => {
    setSaving(true);
    const onboarding_data = {
      ...(dbProfile?.onboarding_data as Record<string, unknown> || {}),
      esnName: profile.esnName,
      size: profile.size,
      offers: profile.offers,
      sectors: profile.sectors,
      clientType: profile.clientType,
      personas: profile.personas,
      geo: profile.geo,
      existingRefs: profile.existingRefs,
      salesCycle: profile.salesCycle,
      avgTJM: profile.avgTJM,
      salesTeamSize: profile.salesTeamSize,
      mainChallenge: profile.mainChallenge,
      bench: profile.bench,
      style: profile.style,
      references: profile.references,
      excludedPersonas: profile.excludedPersonas,
    };
    const { error } = await updateProfile({
      onboarding_data,
      company_name: profile.esnName,
    } as { onboarding_data: Record<string, unknown>; company_name: string });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder le profil.", variant: "destructive" });
    } else {
      toast({ title: "Profil enregistré", description: "Vos modifications ont été sauvegardées." });
    }
  };

  const addItem = (field: "bench" | "references" | "excludedPersonas", value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setProfile(p => ({ ...p, [field]: [...p[field], value.trim()] }));
      setter("");
    }
  };

  const removeItem = (field: "bench" | "references" | "excludedPersonas", index: number) => {
    setProfile(p => ({ ...p, [field]: p[field].filter((_, j) => j !== index) }));
  };

  if (profileLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h1 className="font-display text-xl font-bold">Mon profil ESN</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Plus votre profil est complet, plus les plans de compte et les messages sont pertinents.</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Basic info */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-display text-sm font-semibold">Informations de base</h3>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nom ESN</label>
                <Input value={profile.esnName} onChange={(e) => setProfile(p => ({ ...p, esnName: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Taille</label>
                <Input value={profile.size} onChange={(e) => setProfile(p => ({ ...p, size: e.target.value }))} className="bg-background" />
              </div>

              <ChipSection label="Offres" items={profile.offers} color="primary" />
              <ChipSection label="Secteurs" items={profile.sectors} />
              <ChipSection label="Type clients" items={profile.clientType} />
              <ChipSection label="Personas" items={profile.personas} />
              <ChipSection label="Zone géo" items={profile.geo} />
              <ChipSelect
                label="Référencements actifs"
                options={["Oui, sur des grands comptes", "Oui, sur des ETI", "Non, nous partons de zéro", "Quelques-uns, en cours de renouvellement"]}
                value={profile.existingRefs}
                onChange={(v) => setProfile((p) => ({ ...p, existingRefs: v }))}
              />
              <RadioSection
                label="Cycle de vente moyen"
                options={["Moins de 3 mois", "3 à 6 mois", "6 à 12 mois", "Plus de 12 mois"]}
                value={profile.salesCycle}
                onChange={(v) => setProfile((p) => ({ ...p, salesCycle: v }))}
              />
              <RadioSection
                label="TJM moyen"
                options={["Moins de 400€", "400€ - 600€", "600€ - 900€", "900€+"]}
                value={profile.avgTJM}
                onChange={(v) => setProfile((p) => ({ ...p, avgTJM: v }))}
              />
              <RadioSection
                label="Équipe commerciale"
                options={["Je suis seul(e)", "2 - 5 commerciaux", "5 - 15 commerciaux", "15+ commerciaux"]}
                value={profile.salesTeamSize}
                onChange={(v) => setProfile((p) => ({ ...p, salesTeamSize: v }))}
              />
              <RadioSection
                label="Principal défi commercial"
                options={[
                  "Identifier de nouveaux comptes à prospecter",
                  "Trouver les bons interlocuteurs sur des comptes connus",
                  "Rédiger des messages qui convertissent",
                  "Structurer mon approche plan de compte",
                ]}
                value={profile.mainChallenge}
                onChange={(v) => setProfile((p) => ({ ...p, mainChallenge: v }))}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Advanced */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }} className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-5">
              <h3 className="font-display text-sm font-semibold">
                Profil avancé <span className="text-muted-foreground font-normal">(optionnel)</span>
              </h3>

              {/* Bench */}
              <EditableList
                label="Mon bench actuel"
                items={profile.bench}
                placeholder="Ex : 2 dev React"
                newValue={newBench}
                onNewValueChange={setNewBench}
                onAdd={() => addItem("bench", newBench, setNewBench)}
                onRemove={(i) => removeItem("bench", i)}
              />

              {/* Style */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mon style commercial</label>
                {[
                  { key: "formal", label: "Formel et institutionnel" },
                  { key: "direct", label: "Direct et orienté valeur" },
                  { key: "challenger", label: "Challenger et provocateur" },
                ].map((style) => (
                  <button
                    key={style.key}
                    onClick={() => setProfile(p => ({ ...p, style: style.key }))}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                      profile.style === style.key
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {profile.style === style.key ? "●" : "○"} {style.label}
                  </button>
                ))}
              </div>

              {/* References */}
              <EditableList
                label="Mes références clés"
                items={profile.references}
                placeholder="Ex : SNCF — mission data"
                newValue={newRef}
                onNewValueChange={setNewRef}
                onAdd={() => addItem("references", newRef, setNewRef)}
                onRemove={(i) => removeItem("references", i)}
              />

              {/* Excluded Personas */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Personas à exclure</label>
                <div className="flex flex-wrap gap-1.5">
                  {profile.excludedPersonas.map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                      {p}
                      <button onClick={() => removeItem("excludedPersonas", i)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex : Stagiaires"
                    value={newExcluded}
                    onChange={(e) => setNewExcluded(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem("excludedPersonas", newExcluded, setNewExcluded)}
                    className="bg-background text-sm h-8"
                  />
                  <Button variant="outline" size="sm" onClick={() => addItem("excludedPersonas", newExcluded, setNewExcluded)} className="h-8">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Info banner */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.2 }} className="mt-6">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Plus votre profil est complet, plus les résultats sont personnalisés et pertinents.
          </p>
        </div>
      </motion.div>

      {/* Zone dangereuse — Suppression de compte */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.25 }} className="mt-10">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zone dangereuse
            </h3>
            <p className="text-xs text-muted-foreground">
              La suppression de votre compte est définitive. Toutes vos données (comptes, contacts, analyses) seront perdues.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Supprimer mon compte
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes vos données seront supprimées. Vous devrez créer un nouveau compte pour utiliser Bellum AI à nouveau.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async (e) => {
                      e.preventDefault();
                      setDeleting(true);
                      const { error } = await supabase.auth.deleteUser();
                      setDeleting(false);
                      if (error) {
                        toast({ title: "Erreur", description: error.message || "Impossible de supprimer le compte.", variant: "destructive" });
                        return;
                      }
                      toast({ title: "Compte supprimé", description: "Votre compte a été supprimé." });
                      navigate("/", { replace: true });
                    }}
                    disabled={deleting}
                  >
                    {deleting ? "Suppression…" : "Oui, supprimer mon compte"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function ChipSection({ label, items, color }: { label: string; items: string[]; color?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge
            key={item}
            className={color === "primary" ? "bg-primary/10 text-primary border-primary/20 text-xs" : "text-xs"}
            variant={color === "primary" ? "outline" : "secondary"}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ChipSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((x) => x !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
              value.includes(opt) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-background text-muted-foreground hover:bg-secondary"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioSection({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
              value === opt ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"
            }`}
          >
            {value === opt ? "●" : "○"} {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditableList({ label, items, placeholder, newValue, onNewValueChange, onAdd, onRemove }: {
  label: string; items: string[]; placeholder: string; newValue: string;
  onNewValueChange: (v: string) => void; onAdd: () => void; onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="flex-1 rounded-md border border-border bg-background px-3 py-1.5">{item}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(i)}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={newValue}
          onChange={(e) => onNewValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          className="bg-background text-sm h-8"
        />
        <Button variant="outline" size="sm" onClick={onAdd} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
