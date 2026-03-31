import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("./pages/Landing"));
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Search = lazy(() => import("./pages/Search"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Contacts = lazy(() => import("./pages/Contacts"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Billing = lazy(() => import("./pages/Billing"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Help = lazy(() => import("./pages/Help"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Legal = lazy(() => import("./pages/Legal"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement…
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes — no sidebar */}
              <Route path="/" element={<Landing />} />
              <Route path="/features" element={<Features />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Post-signup routes */}
              <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* Legal pages — no sidebar */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/legal" element={<Legal />} />

              {/* App routes — with sidebar layout, protected */}
              <Route path="/dashboard" element={<ProtectedRoute><Layout><ErrorBoundary><Dashboard /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Layout><ErrorBoundary><Search /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/accounts" element={<ProtectedRoute><Layout><ErrorBoundary><Accounts /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/accounts/:id" element={<ProtectedRoute><Layout><ErrorBoundary><AccountDetail /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Layout><ErrorBoundary><Contacts /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Layout><ErrorBoundary><Profile /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/knowledge" element={<ProtectedRoute><Layout><ErrorBoundary><KnowledgeBase /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><Layout><ErrorBoundary><Billing /></ErrorBoundary></Layout></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Layout><ErrorBoundary><Help /></ErrorBoundary></Layout></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
