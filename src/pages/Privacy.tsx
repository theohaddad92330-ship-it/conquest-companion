import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function Privacy() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-invert prose-sm max-w-none">
        <h1 className="font-display text-xl font-bold mb-6">Politique de confidentialité</h1>
        <p className="text-muted-foreground text-sm mb-4">Dernière mise à jour : 1er mars 2026</p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">1. Données collectées</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Nous collectons les données nécessaires à la fourniture du service : email, nom, profil ESN, et historique d'utilisation. Les résultats d'analyse sont stockés de manière sécurisée.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">2. Utilisation des données</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Vos données sont utilisées exclusivement pour personnaliser les résultats d'analyse et améliorer le service. Aucune donnée n'est partagée avec des tiers à des fins commerciales.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">3. Stockage et sécurité</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Les données sont hébergées en Europe (infrastructure Supabase/AWS). Chiffrement en transit (TLS) et au repos. Isolation complète des données entre utilisateurs.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">4. Vos droits</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à privacy@bellum.ai.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">5. Cookies</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Nous utilisons uniquement des cookies fonctionnels nécessaires au bon fonctionnement de l'application. Aucun cookie publicitaire n'est utilisé.
        </p>
      </motion.div>
    </div>
  );
}
