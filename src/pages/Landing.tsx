import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Target, Download, CheckCircle, Zap, ArrowRight,
  Building2, Users, Mail, Shield, BarChart3, FileText, Layers, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import heroDashboard from "@/assets/hero-dashboard.jpg";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.15 } } };

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      {/* HERO */}
      <section className="pt-32 pb-20 px-6">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-3xl text-center">
          <motion.div variants={fadeUp}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-semibold border border-primary/20 bg-primary/5 text-primary">
              Intelligence commerciale pour ESN
            </Badge>
          </motion.div>

          <motion.h1 variants={fadeUp} className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
            Transformez un nom de compte{" "}
            <span className="text-gradient-bellum">en plan de conquête.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg text-foreground/70 max-w-xl mx-auto mb-10">
            Bellum analyse vos comptes cibles, identifie les décideurs, et produit des messages personnalisés prêts à envoyer. <span className="text-primary font-medium">En 10 minutes.</span>
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-base px-8 h-12" asChild>
              <Link to="/signup">Essayer gratuitement <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 h-12" asChild>
              <a href="#how-it-works">Voir comment ça marche</a>
            </Button>
          </motion.div>

          {/* App screenshot */}
          <motion.div variants={fadeUp} className="mt-16 rounded-xl border border-border bg-card p-2 bellum-glow">
            <img
              src={heroDashboard}
              alt="Aperçu du dashboard Bellum AI — intelligence commerciale pour ESN"
              className="rounded-lg w-full h-auto"
              loading="lazy"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-6 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl font-bold mb-4">Comment ça marche</motion.h2>
            <motion.p variants={fadeUp} className="text-foreground/60 max-w-lg mx-auto">3 étapes pour passer d'un nom d'entreprise à un plan d'action complet, personnalisé à votre ESN.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", icon: Search, title: "Tapez un nom de compte", desc: "Entrez le nom d'une entreprise cible dans la barre de recherche. Bellum récupère automatiquement les données publiques : structure, actualités, projets IT, signaux d'achat et contexte sectoriel.", detail: "Ex : « Société Générale », « Airbus », « SNCF »" },
              { step: "2", icon: Target, title: "Bellum analyse et cartographie", desc: "L'IA identifie les décideurs clés (DSI, Achats, Sponsors), construit l'organigramme, détecte les angles d'attaque pertinents et génère des messages personnalisés adaptés à vos offres.", detail: "Score de priorité, chaîne d'influence, enjeux IT détectés" },
              { step: "3", icon: Download, title: "Exportez et passez à l'action", desc: "Téléchargez votre plan de compte complet : fichier de prospection CSV, emails prêts à envoyer, messages LinkedIn, et plan d'action sur 4 semaines avec les étapes clés.", detail: "CSV, Google Sheets, copier-coller direct" },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp}>
                <Card className="h-full border-border bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-display font-bold text-lg">{item.step}</div>
                    <item.icon className="h-8 w-8 text-primary mx-auto" />
                    <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-foreground/60 leading-relaxed">{item.desc}</p>
                    <p className="text-xs text-primary/70 font-medium italic">{item.detail}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES SUMMARY */}
      <section id="features" className="py-20 px-6 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl font-bold mb-4">Tout ce dont un commercial ESN a besoin.</motion.h2>
            <motion.p variants={fadeUp} className="text-foreground/60 max-w-lg mx-auto">Chaque fonctionnalité est pensée pour le cycle de vente des sociétés de services numériques.</motion.p>
          </motion.div>

          <motion.ul initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-4 max-w-xl mx-auto">
            {[
              "Fiche compte enrichie (enjeux, projets IT, signaux d'achat)",
              "50 à 100 contacts clés avec rôle décisionnel identifié",
              "Organigramme interactif des chaînes d'influence",
              "3 angles d'attaque personnalisés selon vos offres",
              "Plan d'action structuré sur 4 semaines",
              "Emails + messages LinkedIn rédigés et prêts à envoyer",
              "Fichier de prospection exportable en CSV et Google Sheets",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-bellum-success shrink-0 mt-0.5" />
                <span className="text-foreground/80">{item}</span>
              </motion.li>
            ))}
          </motion.ul>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mt-10 space-y-3">
            <Button size="lg" asChild>
              <Link to="/signup">Essayer gratuitement <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <p className="text-sm text-foreground/50">
              <Link to="/features" className="text-primary hover:underline font-medium">Voir toutes les fonctionnalités en détail →</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* BUILT FOR ESN */}
      <section className="py-20 px-6 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl font-bold mb-4 text-center">Pas un outil généraliste.</motion.h2>
            <motion.p variants={fadeUp} className="text-center text-foreground/60 mb-4 max-w-lg mx-auto">Bellum n'est pas un CRM, ni un outil de scraping. C'est un moteur d'intelligence commerciale conçu exclusivement pour les ESN et sociétés de conseil IT.</motion.p>
            <motion.p variants={fadeUp} className="text-center text-foreground/50 text-sm mb-10 max-w-md mx-auto">Chaque analyse tient compte de votre positionnement, de vos offres et de votre historique pour des recommandations réellement actionnables.</motion.p>
            <motion.div variants={stagger} className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                { icon: Layers, title: "Angles d'attaque sur-mesure", desc: "Basés sur vos offres, votre bench actuel et votre positionnement sectoriel" },
                { icon: Mail, title: "Messages calibrés B2B prestation", desc: "Tonalité et arguments adaptés au cycle de vente long des ESN" },
                { icon: Users, title: "Personas métier identifiés", desc: "DSI, Achats IT, Sponsors, Ops — ciblage précis des chaînes de décision" },
                { icon: FileText, title: "Méthodologie plan de compte", desc: "Approche structurée en 4 semaines avec jalons et relances intégrées" },
                { icon: Shield, title: "Exclusion des référencements existants", desc: "Filtrez les comptes où vous êtes déjà référencé pour cibler les nouvelles conquêtes" },
                { icon: Clock, title: "ROI immédiat : 10 min par compte", desc: "Ce qui prenait 2 jours de recherche manuelle est fait en quelques minutes" },
              ].map((item) => (
                <motion.div key={item.title} variants={fadeUp} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                  <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* PRICING SUMMARY */}
      <section className="py-20 px-6 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl font-bold mb-4">Tarifs simples</motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Starter", price: "99€", period: "/mois par user", accounts: "5 comptes/mois", cta: "Essayer", popular: false },
              { name: "Pro", price: "249€", period: "/mois par user", accounts: "20 comptes/mois", cta: "Essayer", popular: true },
              { name: "Scale", price: "Sur devis", period: "", accounts: "Illimité + API", cta: "Contacter", popular: false },
            ].map((plan) => (
              <motion.div key={plan.name} variants={fadeUp}>
                <Card className={`h-full border-border bg-card relative ${plan.popular ? "border-primary bellum-glow" : ""}`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-primary text-primary-foreground text-xs">Populaire</Badge></div>}
                  <CardContent className="p-6 text-center space-y-4">
                    <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                    <div><span className="font-display text-3xl font-bold">{plan.price}</span><span className="text-sm text-foreground/50">{plan.period}</span></div>
                    <p className="text-sm text-foreground/60">{plan.accounts}</p>
                    <Button variant={plan.popular ? "default" : "outline"} className="w-full" asChild>
                      <Link to="/signup">{plan.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-sm text-foreground/50 mt-8">
            Tous les plans incluent : enrichissement contacts, messages personnalisés, export CSV, support.{" "}
            <Link to="/pricing" className="text-primary hover:underline font-medium">Voir tous les détails →</Link>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-12 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="font-display font-bold">Bellum AI</span>
              </div>
              <p className="text-sm text-foreground/50">Transformez un nom de compte en plan de conquête.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Produit</h4>
              <div className="space-y-2">
                <Link to="/features" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">Fonctionnalités</Link>
                <Link to="/pricing" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">Tarifs</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Ressources</h4>
              <div className="space-y-2">
                <Link to="/help" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">Support</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Légal</h4>
              <div className="space-y-2">
                <Link to="/terms" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">CGV</Link>
                <Link to="/privacy" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">Confidentialité</Link>
                <Link to="/legal" className="block text-sm text-foreground/50 hover:text-foreground transition-colors">Mentions légales</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border text-center text-xs text-foreground/30">
            © 2026 Bellum AI. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
