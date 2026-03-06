import { motion } from "framer-motion";
import { Coins, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

const history = [
  { month: "Mars 2026", accounts: "—", contacts: "—", cost: "—" },
  { month: "Février 2026", accounts: "—", contacts: "—", cost: "—" },
  { month: "Janvier 2026", accounts: "—", contacts: "—", cost: "—" },
];

export default function Billing() {
  const { toast } = useToast();
  const { credits, isLoading, usagePercent, contactsPercent } = useCredits();

  const plan = credits?.plan || "free";
  const used = credits?.accounts_used ?? 0;
  const total = credits?.accounts_limit ?? 3;
  const contactsUsed = credits?.contacts_enriched ?? 0;
  const contactsTotal = credits?.contacts_limit ?? 50;
  const renewDate = credits?.period_end ? new Date(credits.period_end).toLocaleDateString("fr-FR") : "1er du mois prochain";

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {credits?.plan === "free" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Vous êtes en plan gratuit</p>
              <p className="text-xs text-muted-foreground">3 analyses de comptes offertes. Passez au plan Pro pour analyser 20 comptes/mois.</p>
            </div>
            <Button size="sm" onClick={() => window.open("mailto:contact@bellum.ai?subject=Upgrade plan Bellum", "_blank")}>
              Passer au Pro
            </Button>
          </CardContent>
        </Card>
      )}

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
                <Progress value={usagePercent} className="h-2" />
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
                onClick={() => toast({ title: "Bientôt disponible", description: "L'abonnement en ligne arrive très prochainement. Contactez-nous pour upgrader." })}
              >
                Changer de plan
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open("mailto:contact@bellum.ai?subject=Upgrade plan Bellum", "_blank")}
              >
                <CreditCard className="h-3.5 w-3.5" />Nous contacter
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
