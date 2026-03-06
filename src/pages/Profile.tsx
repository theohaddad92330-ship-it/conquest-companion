import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Plus, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function Profile() {
  const { toast } = useToast();
  const { profile: dbProfile, updateProfile } = useProfile();
  const onboardingData = dbProfile?.onboarding_data || {};
  const [profile, setProfile] = useState({
    esnName: onboardingData.esnName || "",
    size: onboardingData.size || "",
    offers: onboardingData.offers || [],
    sectors: onboardingData.sectors || [],
    clientType: onboardingData.clientType || [],
    personas: onboardingData.personas || [],
    geo: onboardingData.geo || [],
    bench: onboardingData.bench || [],
    style: onboardingData.style || "direct",
    references: onboardingData.references || [],
    excludedPersonas: onboardingData.excludedPersonas || [],
  });
  const [newBench, setNewBench] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newExcluded, setNewExcluded] = useState("");

  useEffect(() => {
    const data = dbProfile?.onboarding_data || {};
    setProfile({
      esnName: data.esnName || "",
      size: data.size || "",
      offers: data.offers || [],
      sectors: data.sectors || [],
      clientType: data.clientType || [],
      personas: data.personas || [],
      geo: data.geo || [],
      bench: data.bench || [],
      style: data.style || "direct",
      references: data.references || [],
      excludedPersonas: data.excludedPersonas || [],
    });
  }, [dbProfile]);

  const addItem = (field: "bench" | "references" | "excludedPersonas", value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setProfile(p => ({ ...p, [field]: [...p[field], value.trim()] }));
      setter("");
    }
  };

  const removeItem = (field: "bench" | "references" | "excludedPersonas", index: number) => {
    setProfile(p => ({ ...p, [field]: p[field].filter((_, j) => j !== index) }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Mon profil ESN</h1>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            await updateProfile({ onboarding_data: { ...(dbProfile?.onboarding_data || {}), ...profile } });
            toast({ title: "Profil enregistré", description: "Vos modifications ont été sauvegardées." });
          }}
        >
          Enregistrer
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
