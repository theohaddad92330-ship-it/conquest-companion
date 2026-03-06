import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [navigate, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const isIdle = true;

  return (
    <div className="flex flex-col h-full">
      <div
        className={`flex flex-col items-center justify-center transition-all duration-500 ${
          isIdle ? "flex-1" : "pt-8 pb-6 px-6"
        }`}
      >
        <AnimatePresence mode="wait">
          {isIdle && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Intelligence commerciale pour ESN
                </span>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3 md:text-4xl">
                Analysez n'importe quel compte
                <br />
                <span className="text-gradient-bellum">en quelques secondes</span>
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Entrez un nom d'entreprise et obtenez une fiche compte enrichie
                avec enjeux IT, signaux récents et score de priorité.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className={`w-full ${isIdle ? "max-w-xl px-6" : "max-w-3xl"}`}>
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Entrez un nom d'entreprise (ex : Société Générale)"
                className="h-12 pl-10 pr-4 text-sm bg-card border-border focus-visible:ring-primary/50 bellum-glow"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || analysis.status === "loading"}
              size="lg"
              className="h-12 px-6 font-semibold"
            >
              {analysis.status === "loading" ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Analyse...
                </span>
              ) : (
                "Analyser"
              )}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Index;
