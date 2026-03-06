import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function Legal() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-invert prose-sm max-w-none">
        <h1 className="font-display text-xl font-bold mb-6">Mentions légales</h1>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">Éditeur</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Bellum AI SAS<br />
          Capital social : 10 000 €<br />
          Siège social : Paris, France<br />
          RCS Paris : XXX XXX XXX<br />
          Directeur de la publication : [Nom du dirigeant]
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">Hébergement</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Le site est hébergé par Vercel Inc. et les données sont stockées sur l'infrastructure Supabase (AWS Europe - Irlande).
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">Contact</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Email : contact@bellum.ai<br />
          Support : support@bellum.ai
        </p>

        <h2 className="font-display text-base font-semibold mt-6 mb-2">Propriété intellectuelle</h2>
        <p className="text-sm text-muted-foreground mb-4">
          L'ensemble du contenu de la plateforme Bellum AI (textes, visuels, code, algorithmes) est protégé par le droit d'auteur. Toute reproduction est interdite sans autorisation.
        </p>
      </motion.div>
    </div>
  );
}
