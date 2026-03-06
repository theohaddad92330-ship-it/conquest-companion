import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Search, Users, Target, Mail, FileText, BarChart3,
  Download, Layers, GitBranch, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const featureBlocks = [
  { icon: Search, title: "Recherche intelligente", desc: "Tapez un nom d'entreprise et Bellum récupère automatiquement toutes les données publiques : structure juridique, effectifs, actualités récentes, projets IT en cours, appels d'offres et signaux d'achat.", highlights: ["Données enrichies en temps réel", "Signaux d'achat détectés", "Actualités et projets IT"] },
  { icon: Users, title: "Identification des décideurs", desc: "Bellum identifie entre 50 et 100 contacts clés par compte avec leur rôle décisionnel : DSI, Directeurs de projet, Achats IT, Sponsors métier. Chaque contact est qualifié avec email professionnel et profil LinkedIn.", highlights: ["50-100 contacts par compte", "Emails professionnels vérifiés", "Rôle décisionnel identifié"] },
  { icon: GitBranch, title: "Organigramme et chaînes d'influence", desc: "Visualisez la hiérarchie et les chaînes de décision au sein du compte cible. Identifiez qui influence qui, les sponsors potentiels et les prescripteurs techniques.", highlights: ["Hiérarchie visualisée", "Chaînes de décision", "Sponsors identifiés"] },
  { icon: Target, title: "Angles d'attaque personnalisés", desc: "3 angles d'attaque générés automatiquement en fonction de vos offres, de votre bench actuel et du contexte du compte.", highlights: ["Basés sur vos offres", "Argumentés et actionnables", "Points d'entrée identifiés"] },
  { icon: Mail, title: "Messages prêts à envoyer", desc: "Emails et messages LinkedIn rédigés avec la bonne tonalité B2B prestation. Personnalisés selon le persona ciblé, le contexte du compte et votre positionnement.", highlights: ["Emails + LinkedIn", "Tonalité B2B calibrée", "Personnalisés par persona"] },
  { icon: FileText, title: "Plan d'action 4 semaines", desc: "Un plan d'action structuré avec les étapes clés, les relances prévues, les jalons de qualification et les objectifs hebdomadaires.", highlights: ["Jalons hebdomadaires", "Relances planifiées", "Objectifs de qualification"] },
  { icon: Download, title: "Export multi-format", desc: "Exportez l'intégralité de votre plan de compte en CSV pour votre CRM, en Google Sheets pour le partage équipe, ou copiez directement les messages.", highlights: ["Export CSV", "Google Sheets", "Copier-coller direct"] },
  { icon: BarChart3, title: "Score de priorité intelligent", desc: "Chaque compte reçoit un score de 1 à 10 basé sur la taille, les signaux d'achat détectés, l'adéquation avec vos offres et le potentiel de conversion.", highlights: ["Score 1-10 automatique", "Signaux d'achat pondérés", "Priorisation intelligente"] },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <div className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-20">
            <motion.div variants={fadeUp}>
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-semibold border border-primary/20 bg-primary/5 text-primary">Fonctionnalités</Badge>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-3xl md:text-5xl font-bold mb-4">Tout pour conquérir vos comptes cibles.</motion.h1>
            <motion.p variants={fadeUp} className="text-foreground/60 text-lg max-w-2xl mx-auto">De la recherche à l'export, chaque fonctionnalité est conçue pour le cycle de vente des ESN. Pas de superflu — que de l'actionnable.</motion.p>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
            {featureBlocks.map((feature, i) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="border-border bg-card hover:border-primary/20 transition-colors">
                  <CardContent className="p-6 md:p-8">
                    <div className={`flex flex-col md:flex-row gap-6 ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <feature.icon className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
                        </div>
                        <p className="text-sm text-foreground/60 leading-relaxed">{feature.desc}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {feature.highlights.map((h) => (
                            <span key={h} className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/5 border border-primary/10 rounded-full px-3 py-1">
                              <CheckCircle className="h-3 w-3" />{h}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="md:w-64 flex items-center justify-center">
                        <div className="w-full h-40 rounded-lg bg-secondary/50 border border-border flex items-center justify-center">
                          <feature.icon className="h-12 w-12 text-primary/20" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mt-20 space-y-4">
            <h2 className="font-display text-2xl font-bold">Prêt à transformer votre prospection ?</h2>
            <p className="text-foreground/50 text-sm">Commencez gratuitement — aucune carte bancaire requise.</p>
            <Button size="lg" asChild>
              <Link to="/signup">Essayer gratuitement <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-border py-8 px-6 text-center text-sm text-foreground/40">
        © 2026 Bellum AI. Tous droits réservés.
      </footer>
    </div>
  );
}
