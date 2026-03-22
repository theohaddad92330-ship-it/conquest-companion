import { motion } from "framer-motion";
import { HelpCircle, Mail, Play, Search, Building2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

const faq = [
  { q: "Comment lancer une analyse ?", a: "Tapez le nom d'une entreprise dans la barre de recherche depuis le Dashboard ou la page Nouvelle recherche, puis cliquez sur Analyser." },
  { q: "Combien de temps dure une analyse ?", a: "La fiche compte s’affiche rapidement. La génération des messages est désormais à la demande (onglet Messages) pour éviter les attentes longues et rendre le flux plus fiable." },
  { q: "Comment fonctionnent les crédits ?", a: "Chaque analyse d'un nouveau compte consomme 1 crédit. Relancer une analyse existante consomme également 1 crédit. Les crédits se renouvellent chaque mois." },
  { q: "Puis-je exporter mes résultats ?", a: "Oui, chaque fiche compte peut être exportée en CSV ou directement dans Google Sheets depuis la page de détail du compte." },
  { q: "Comment personnaliser les résultats ?", a: "Complétez votre profil ESN dans les paramètres (offres, secteurs cibles, bench, références). Plus il est complet, plus les angles d'attaque et messages seront pertinents." },
  { q: "Les contacts sont-ils vérifiés ?", a: "Les contacts LinkedIn proviennent d’Apify. Les emails/numéros peuvent être absents selon les sources. Un badge “✅ vérifié” s’affiche uniquement si l’email a été vérifié." },
  { q: "Puis-je ajuster une analyse ?", a: "Oui, en bas de chaque fiche compte, utilisez la zone 'Ajuster la recherche' pour affiner les résultats (exclure une filiale, insister sur un angle, etc.)." },
  { q: "Comment changer de plan ?", a: "Rendez-vous dans Crédits & plan depuis la sidebar pour voir votre plan actuel et les options d'upgrade." },
  { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Vos données sont chiffrées et isolées. Aucun partage entre utilisateurs. Conformité RGPD." },
  { q: "Comment contacter le support ?", a: "Envoyez un email à support@bellum.ai. Les utilisateurs Pro bénéficient d'un support prioritaire." },
];

const steps = [
  { icon: Search, title: "1. Recherchez", desc: "Tapez le nom d'un compte cible dans la barre de recherche" },
  { icon: Building2, title: "2. Analysez", desc: "Bellum identifie les décideurs, enjeux IT et signaux récents" },
  { icon: Download, title: "3. Agissez", desc: "Exportez et utilisez les messages personnalisés prêts à envoyer" },
];

export default function Help() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Aide</h1>
        </div>
        <p className="text-sm text-muted-foreground">Tout ce qu'il faut savoir pour bien utiliser Bellum AI.</p>
      </motion.div>

      {/* Quick start */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.05 }}>
        <h2 className="font-display text-sm font-semibold mb-4">🚀 Démarrage rapide</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((step) => (
            <Card key={step.title} className="border-border">
              <CardContent className="p-4 space-y-2 text-center">
                <div className="mx-auto h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Video */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}>
        <Card className="border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Vidéo de démo (2 min)</p>
              <p className="text-xs text-muted-foreground">Découvrez le flux complet : de la recherche à l'export des messages.</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 ml-auto">Regarder</Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* FAQ */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.15 }}>
        <h2 className="font-display text-sm font-semibold mb-4">❓ Questions fréquentes</h2>
        <Card className="border-border">
          <CardContent className="p-0">
            <Accordion type="single" collapsible>
              {faq.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border px-5">
                  <AccordionTrigger className="text-sm font-medium py-4">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* Support */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.2 }}>
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Besoin d'aide ?</p>
              <p className="text-xs text-muted-foreground">Contactez-nous à support@bellum.ai</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@bellum.ai">Écrire</a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
