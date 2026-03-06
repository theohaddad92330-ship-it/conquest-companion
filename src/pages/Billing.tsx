import { motion } from "framer-motion";
import { Coins, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { credits as mockCredits, creditsPercentage as mockCreditsPercentage, contactsPercentage as mockContactsPercentage } from "@/lib/credits";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

const history = [
  { month: "Mars 2026", accounts: `${mockCredits.used}/${mockCredits.total}`, contacts: `${mockCredits.contactsUsed}/${mockCredits.contactsTotal}`, cost: "~95€" },
  { month: "Février 2026", accounts: "18/20", contacts: "189/200", cost: "~155€" },
  { month: "Janvier 2026", accounts: "9/20", contacts: "87/200", cost: "~68€" },
];

export default function Billing() {
  const { toast } = useToast();
  const { credits } = useCredits();

  const plan = credits?.plan || mockCredits.plan.toLowerCase();
  const used = credits?.accounts_used ?? mockCredits.used;
  const total = credits?.accounts_limit ?? mockCredits.total;
  const contactsUsed = credits?.contacts_enriched ?? mockCredits.contactsUsed;
  const contactsTotal = credits?.contacts_limit ?? mockCredits.contactsTotal;
  const renewDate = credits?.period_end ? new Date(credits.period_end).toLocaleDateString("fr-FR") : mockCredits.renewalDate;
  const accountsPercent = credits
    ? Math.round((used / Math.max(total, 1)) * 100)
    : mockCreditsPercentage();
  const contactsPercent = credits
    ? Math.round((contactsUsed / Math.max(contactsTotal, 1)) * 100)
    : mockContactsPercentage();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <div className="flex items-center gap-2 mb-6">
          <Coins className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Mon plan & crédits</h1>
        </div>

        <Card className="border-border">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display text-lg font-bold">Plan actuel :</p>
                  <Badge className="bg-primary text-primary-foreground">{plan}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Renouvellement le {renewDate}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Comptes analysés</span>
                  <span className="font-mono font-semibold">{used} / {total}</span>
                </div>
                <Progress value={accountsPercent} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Contacts enrichis</span>
                  <span className="font-mono font-semibold">{contactsUsed} / {contactsTotal}</span>
                </div>
                <Progress value={contactsPercent} className="h-2" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast({ title: "Changement de plan", description: "Fonctionnalité disponible prochainement." })}
              >
                Changer de plan
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => toast({ title: "Gestion du paiement", description: "Fonctionnalité disponible prochainement." })}
              >
                <CreditCard className="h-3.5 w-3.5" />Gérer le paiement
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}>
        <h3 className="font-display text-sm font-semibold mb-3">Historique de consommation</h3>
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mois</TableHead>
                <TableHead className="text-xs">Comptes</TableHead>
                <TableHead className="text-xs">Contacts</TableHead>
                <TableHead className="text-xs">Coût API estimé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.month}>
                  <TableCell className="font-medium text-sm">{h.month}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{h.accounts}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{h.contacts}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{h.cost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </motion.div>
    </div>
  );
}
