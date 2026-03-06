import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { PublicNavbar } from "@/components/PublicNavbar";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const features = [
  { name: "Comptes analysés / mois", starter: "5", pro: "20", scale: "Illimité" },
  { name: "Contacts enrichis / compte", starter: "30 max", pro: "100 max", scale: "250 max" },
  { name: "Fiche compte enrichie", starter: true, pro: true, scale: true },
  { name: "Organigramme + rôles", starter: true, pro: true, scale: true },
  { name: "Angles d'attaque personnalisés", starter: true, pro: true, scale: true },
  { name: "Messages email + LinkedIn", starter: true, pro: true, scale: true },
  { name: "Plan d'action 4 semaines", starter: true, pro: true, scale: true },
  { name: "Export CSV", starter: true, pro: true, scale: true },
  { name: "Export Google Sheets", starter: false, pro: true, scale: true },
  { name: "Zone d'ajustement (itération)", starter: false, pro: true, scale: true },
  { name: "Emails enrichis (pro + tel)", starter: "50/mois", pro: "200/mois", scale: "Illimité" },
  { name: "Dashboard manager (vue équipe)", starter: false, pro: false, scale: true },
  { name: "Support", starter: "Email", pro: "Email + prioritaire", scale: "Dédié" },
  { name: "Essai gratuit", starter: "3 comptes", pro: "3 comptes", scale: "Démo" },
];

const faqs = [
  { q: "Puis-je changer de plan ?", a: "Oui, à tout moment. La facturation est ajustée au prorata." },
  { q: "Que se passe-t-il si je dépasse mes crédits ?", a: "Vous pouvez acheter des crédits supplémentaires à l'unité ou passer au plan supérieur." },
  { q: "Y a-t-il un engagement ?", a: "Non, tous les plans sont sans engagement. Vous pouvez résilier à tout moment." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "Inscrivez-vous et recevez 3 analyses de compte gratuites. Aucune carte bancaire requise." },
  { q: "Combien de temps prend une analyse ?", a: "Une analyse complète prend environ 2 à 5 minutes selon la taille du compte." },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? <Check className="h-4 w-4 text-bellum-success mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  }
  return <span className="text-sm">{value}</span>;
}

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <div className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-14">
            <motion.h1 variants={fadeUp} className="font-display text-3xl md:text-5xl font-bold mb-4">Des tarifs alignés sur votre usage.</motion.h1>
            <motion.p variants={fadeUp} className="text-foreground/60 text-lg">Pas de surprise. Payez en fonction du nombre de comptes analysés.</motion.p>
          </motion.div>

          {/* Plan cards */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { name: "Starter", price: "99€", period: "/mois par user", popular: false },
              { name: "Pro", price: "249€", period: "/mois par user", popular: true },
              { name: "Scale", price: "Sur devis", period: "", popular: false },
            ].map((plan) => (
              <motion.div key={plan.name} variants={fadeUp}>
                <Card className={`h-full relative ${plan.popular ? "border-primary bellum-glow" : "border-border"}`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-primary text-primary-foreground">★ Populaire</Badge></div>}
                  <CardContent className="p-6 text-center space-y-4">
                    <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                    <div><span className="font-display text-4xl font-bold">{plan.price}</span><span className="text-sm text-foreground/50">{plan.period}</span></div>
                    <Button variant={plan.popular ? "default" : "outline"} className="w-full" asChild>
                      <Link to="/signup">{plan.name === "Scale" ? "Contacter" : "Essayer gratuitement"}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Feature comparison table */}
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold">Fonctionnalité</th>
                  <th className="p-4 text-center font-semibold">Starter</th>
                  <th className="p-4 text-center font-semibold text-primary">Pro ★</th>
                  <th className="p-4 text-center font-semibold">Scale</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.name} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/30"}`}>
                    <td className="p-4 text-foreground/60">{f.name}</td>
                    <td className="p-4 text-center"><CellValue value={f.starter} /></td>
                    <td className="p-4 text-center"><CellValue value={f.pro} /></td>
                    <td className="p-4 text-center"><CellValue value={f.scale} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-lg border border-border bg-card">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                    <span className="font-medium text-sm">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && <div className="px-4 pb-4 text-sm text-foreground/50">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-16">
            <Button size="lg" asChild>
              <Link to="/signup">Commencer avec 3 comptes gratuits <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-8 px-6 text-center text-sm text-foreground/40">
        © 2026 Bellum AI. Tous droits réservés.
      </footer>
    </div>
  );
}
