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
  { icon: Search, title: "Moins de recherches", desc: "Vous tapez un nom. Bellum rassemble le contexte utile : structure, entités, signaux, projets, enjeux. Vous arrêtez de repartir de zéro à chaque compte.", highlights: ["Contexte regroupé", "Signaux visibles", "Enjeux et projets"] },
  { icon: Users, title: "Vous savez qui viser", desc: "Par compte, Bellum vous aide à couvrir les bons rôles : décideur, champion, achats, opérationnel. Objectif : ne plus bloquer parce qu’il manque la bonne personne.", highlights: ["Rôles clairs", "Couverture par entité", "Priorité par contact"] },
  { icon: GitBranch, title: "Vous voyez où entrer", desc: "Une vue simple compte → entités → contacts. Vous repérez vite les zones non couvertes et les bons points d’entrée.", highlights: ["Entités couvertes", "Zones manquantes", "Points d’entrée"] },
  { icon: Target, title: "Angles reliés à vos offres", desc: "Les angles sont reliés à vos offres ESN et à votre profil. Vous gardez ce qui peut se vendre, vous jetez le reste.", highlights: ["Angles reliés aux offres", "Portes d’entrée", "Ordre d’approche"] },
  { icon: Mail, title: "Messages utilisables", desc: "Des messages par rôle (email / LinkedIn / relance). Vous adaptez, vous envoyez, vous relancez — sans écrire tout depuis une page blanche.", highlights: ["Par rôle", "Email + LinkedIn + relance", "Copier / ouvrir Gmail"] },
  { icon: FileText, title: "Plan d’action simple", desc: "Un plan semaine par semaine. Qui contacter, quand, dans quel ordre. Vous avancez sans vous disperser.", highlights: ["Étapes claires", "Relances", "Objectifs"] },
  { icon: Download, title: "Export pour agir", desc: "CSV et Google Sheets. Vous passez au CRM ou vous partagez avec l’équipe.", highlights: ["CSV", "Google Sheets", "Nom de fichier daté"] },
  { icon: BarChart3, title: "Priorité 1–10 expliquée", desc: "Chaque score est accompagné d’une justification. Vous savez pourquoi c’est haut, moyen ou bas — et quoi faire ensuite.", highlights: ["Score + explication", "Haute / moyenne / basse", "Prochaine action"] },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <div className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-20">
            <motion.div variants={fadeUp}>
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-semibold glass-badge text-primary">Fonctionnalités</Badge>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-3xl md:text-5xl font-bold mb-4">Ce que vous obtenez, compte par compte.</motion.h1>
            <motion.p variants={fadeUp} className="text-foreground/60 text-lg max-w-2xl mx-auto">Objectif : vous faire gagner du temps, enlever le stress, et vous aider à décider quoi faire maintenant.</motion.p>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
            {featureBlocks.map((feature, i) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="glass-card card-hover">
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
                        <div className="w-full h-40 rounded-lg glass flex items-center justify-center">
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
            <h2 className="font-display text-2xl font-bold">Prêt à arrêter de repartir de zéro ?</h2>
            <p className="text-foreground/50 text-sm">Testez sur 3 comptes. Pas de carte bancaire.</p>
            <Button size="lg" asChild>
              <Link to="/signup">Tester sur 3 comptes <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground/40">
        © 2026 Bellum AI. Tous droits réservés.
      </footer>
    </div>
  );
}
