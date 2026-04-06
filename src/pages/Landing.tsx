import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Target, Download, CheckCircle, ArrowRight,
  Building2, Users, Mail, Shield, BarChart3, FileText, Layers, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { BellumLogo } from "@/components/BellumLogo";
import HeroVideoPlayer from "@/components/HeroVideoPlayer";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.15 } } };
const fadeUpSimple = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const integrationBadges = [
  { label: "LinkedIn", icon: "🔗" },
  { label: "Pappers", icon: "📊" },
  { label: "Apollo", icon: "🚀" },
];

const partnerLogos = [
  "Capgemini", "Sopra Steria", "Atos", "Accenture", "CGI", "Alten",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      {/* HERO — Synapse-inspired with video */}
      <section className="relative pt-32 pb-32 px-6 overflow-hidden min-h-[90vh] flex items-center">
        {/* Video background */}
        <HeroVideoPlayer />

        {/* Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl text-center relative z-10"
        >
          {/* Integration badges */}
          <motion.div
            custom={0}
            variants={fadeUp}
            className="flex items-center justify-center gap-3 mb-8"
          >
            {integrationBadges.map((b) => (
              <div
                key={b.label}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 backdrop-blur-md px-4 py-2 text-xs font-medium text-muted-foreground"
              >
                <span>{b.icon}</span>
                <span>Intégré avec {b.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Headline */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-display text-5xl md:text-7xl lg:text-[80px] font-bold leading-[0.95] tracking-tight mb-6"
          >
            Où l'intelligence
            <br />
            <span className="text-gradient-bellum">rencontre l'action.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            custom={2}
            variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Analysez n'importe quel grand compte en quelques secondes.
            <br className="hidden md:block" />
            Bellum identifie les signaux, les décideurs et génère votre plan d'attaque.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            custom={3}
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="text-base px-8 h-13 bg-foreground text-background hover:bg-foreground/90 border border-border/50 font-semibold"
              asChild
            >
              <Link to="/signup">
                Commencer gratuitement
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 h-13 backdrop-blur-md bg-card/30 border-border/50 hover:bg-card/50"
              asChild
            >
              <a href="#how-it-works">
                Voir comment ça marche
              </a>
            </Button>
          </motion.div>
        </motion.div>

        {/* Logo marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-8 left-0 right-0 z-10"
        >
          <div className="flex items-center justify-center gap-12 opacity-40">
            {partnerLogos.map((name) => (
              <span
                key={name}
                className="text-sm font-medium text-muted-foreground tracking-wide uppercase select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-6 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.h2 variants={fadeUpSimple} className="font-display text-3xl md:text-4xl font-bold mb-4">Comment ça marche</motion.h2>
            <motion.p variants={fadeUpSimple} className="text-foreground/60 max-w-lg mx-auto">3 étapes. À la fin, vous savez qui contacter, quoi dire, et dans quel ordre.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", icon: Search, title: "Vous tapez le nom du compte", desc: "Vous donnez une entreprise. Bellum rassemble le contexte utile : structure, filiales, signaux, projets, enjeux.", detail: "Ex : « Société Générale », « Airbus », « SNCF »" },
              { step: "2", icon: Target, title: "Vous voyez où entrer", desc: "Bellum propose les rôles à viser, les portes d'entrée par entité, et les angles à tester selon votre ESN.", detail: "Score, signaux, enjeux, organigramme" },
              { step: "3", icon: Download, title: "Vous passez à l'action", desc: "Vous récupérez une liste exploitable : qui contacter, quoi dire, et quand relancer. Export en CSV / Sheets.", detail: "CSV, Sheets, copier-coller" },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUpSimple}>
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
            <motion.h2 variants={fadeUpSimple} className="font-display text-3xl md:text-4xl font-bold mb-4">Ce que vous gagnez à chaque connexion.</motion.h2>
            <motion.p variants={fadeUpSimple} className="text-foreground/60 max-w-lg mx-auto">Du recul pour décider, et des livrables prêts à utiliser.</motion.p>
          </motion.div>

          <motion.ul initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-4 max-w-xl mx-auto">
            {[
              "Moins de recherches : le contexte utile est déjà rassemblé",
              "Une liste de rôles à viser (décideur, champion, achats, opérationnel)",
              "Des signaux pour relancer au bon moment",
              "Des angles d'approche reliés à vos offres ESN",
              "Un plan d'action simple à suivre semaine par semaine",
              "Des messages prêts à adapter et à envoyer",
              "Un export CSV / Sheets pour passer au CRM",
            ].map((item) => (
              <motion.li key={item} variants={fadeUpSimple} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-bellum-success shrink-0 mt-0.5" />
                <span className="text-foreground/80">{item}</span>
              </motion.li>
            ))}
          </motion.ul>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpSimple} className="text-center mt-10 space-y-3">
            <Button size="lg" asChild>
              <Link to="/signup">Tester sur 3 comptes <ArrowRight className="h-4 w-4" /></Link>
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
            <motion.h2 variants={fadeUpSimple} className="font-display text-3xl md:text-4xl font-bold mb-4 text-center">Conçu pour vendre des missions ESN.</motion.h2>
            <motion.p variants={fadeUpSimple} className="text-center text-foreground/60 mb-4 max-w-lg mx-auto">Vous n'avez pas besoin de "plus de données". Vous avez besoin de savoir quoi faire, sans y passer la journée.</motion.p>
            <motion.p variants={fadeUpSimple} className="text-center text-foreground/50 text-sm mb-10 max-w-md mx-auto">Bellum utilise votre profil ESN (offres, secteurs, personas, zone) pour sortir des recommandations qui collent au terrain.</motion.p>
            <motion.div variants={stagger} className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                { icon: Layers, title: "Angles reliés à vos offres", desc: "Vous évitez les idées hors sujet. Vous gardez ce qui peut se vendre." },
                { icon: Mail, title: "Messages utilisables", desc: "Une base claire par rôle. Vous adaptez et vous envoyez." },
                { icon: Users, title: "Rôles à viser", desc: "Décideur, champion, achats, opérationnel : vous savez qui chercher." },
                { icon: FileText, title: "Plan d'action simple", desc: "Une suite d'étapes pour avancer, sans vous disperser." },
                { icon: Shield, title: "Moins de bruit", desc: "Vous vous concentrez sur les comptes à ouvrir, pas sur ceux déjà gagnés." },
                { icon: Clock, title: "Temps sauvé", desc: "Vous passez moins de temps à chercher, plus de temps à contacter." },
              ].map((item) => (
                <motion.div key={item.title} variants={fadeUpSimple} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
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
            <motion.h2 variants={fadeUpSimple} className="font-display text-3xl md:text-4xl font-bold mb-4">Tarifs simples</motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Starter", price: "99€", period: "/mois par user", accounts: "5 comptes/mois", cta: "Essayer", popular: false },
              { name: "Pro", price: "249€", period: "/mois par user", accounts: "20 comptes/mois", cta: "Essayer", popular: true },
              { name: "Scale", price: "Sur devis", period: "", accounts: "Illimité + API", cta: "Contacter", popular: false },
            ].map((plan) => (
              <motion.div key={plan.name} variants={fadeUpSimple}>
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
                <BellumLogo size={28} className="rounded-lg shadow-none ring-0" />
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
