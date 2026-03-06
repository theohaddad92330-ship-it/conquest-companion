-- RLS sur rag_documents : accès explicite pour utilisateurs authentifiés.
-- Sans RLS, la table était accessible selon les grants par défaut Supabase.
-- On rend la politique d'accès explicite et on limite les abus.

ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié peut lire (contexte partagé pour l'IA).
CREATE POLICY "Authenticated users can read rag_documents"
  ON public.rag_documents FOR SELECT
  TO authenticated
  USING (true);

-- Insertion / mise à jour / suppression : tout utilisateur authentifié.
-- À terme, on pourra ajouter user_id à la table et restreindre à ses propres documents.
CREATE POLICY "Authenticated users can insert rag_documents"
  ON public.rag_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rag_documents"
  ON public.rag_documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete rag_documents"
  ON public.rag_documents FOR DELETE
  TO authenticated
  USING (true);
