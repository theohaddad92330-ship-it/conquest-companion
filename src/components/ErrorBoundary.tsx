import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
          <p className="text-sm font-medium text-destructive">
            {this.props.fallbackMessage ?? "Une erreur inattendue s'est produite"}
          </p>
          <p className="text-xs text-muted-foreground">Rechargez la page. Si le problème continue, contactez le support.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
