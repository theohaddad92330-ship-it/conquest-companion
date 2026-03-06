import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function Terms() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-invert prose-sm max-w-none">
        <h1 className="font-display text-xl font-bold mb-6">Conditions Générales de Vente</h1>
        <p className="text-muted-foreground text-sm mb-4">Dernière mise à jour : 1er mars 2026</p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">1. Objet</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Les présentes CGV régissent l'utilisation de la plateforme Bellum AI, un outil SaaS de prospection commerciale destiné aux ESN (Entreprises de Services du Numérique).
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">2. Accès au service</h2>
        <p className="text-sm text-muted-foreground mb-4">
          L'accès au service nécessite la création d'un compte. Un essai gratuit de 3 comptes est offert à tout nouvel utilisateur. L'utilisation au-delà nécessite un abonnement payant.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">3. Tarification</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Les tarifs sont indiqués sur la page Tarifs. La facturation est mensuelle. Les crédits non utilisés ne sont pas reportés au mois suivant.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">4. Données personnelles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Bellum AI traite les données conformément au RGPD. Les données des utilisateurs sont isolées et chiffrées. Voir notre Politique de confidentialité pour plus de détails.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">5. Responsabilité</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Bellum AI fournit des informations à titre indicatif. Les résultats d'analyse sont générés par IA et doivent être vérifiés par l'utilisateur avant utilisation.
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">6. Résiliation</h2>
        <p className="text-sm text-muted-foreground mb-4">
          L'abonnement peut être résilié à tout moment depuis les paramètres du compte. La résiliation prend effet à la fin de la période de facturation en cours.
        </p>
      </motion.div>
    </div>
  );
}
