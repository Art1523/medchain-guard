import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Manufacturer from "./pages/Manufacturer";
import Chain from "./pages/Chain";
import Scan from "./pages/Scan";
import ResultPage from "./pages/Result";
import VerifyImage from "./pages/VerifyImage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/result/:productId" element={<ResultPage />} />
              <Route path="/verify-image" element={<VerifyImage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/manufacturer" element={
                <ProtectedRoute requireRole={["manufacturer"]}><Manufacturer /></ProtectedRoute>
              } />
              <Route path="/chain" element={
                <ProtectedRoute requireRole={["manufacturer", "distributor", "pharmacy"]}><Chain /></ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
