import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCartSync } from "@/hooks/useCartSync";
import { SizeAdvisorProvider } from "@/components/SizeAdvisor";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import LooksPage from "./pages/Looks.tsx";
import LookDetail from "./pages/LookDetail.tsx";
import Shop from "./pages/Shop.tsx";
import Neuheiten from "./pages/Neuheiten.tsx";
import Sale from "./pages/Sale.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import { MarkenDetail, MarkenIndex } from "./pages/Marken.tsx";
import { MagazinDetail, MagazinIndex } from "./pages/Magazin.tsx";
import Groessen from "./pages/Groessen.tsx";
import Saison from "./pages/Saison.tsx";
import AdminImport from "./pages/AdminImport.tsx";
import AdminLooks from "./pages/AdminLooks.tsx";

const queryClient = new QueryClient();

const CartSyncBoundary = ({ children }: { children: React.ReactNode }) => {
  useCartSync();
  return <>{children}</>;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <ScrollToTop />
        <CartSyncBoundary>
          <SizeAdvisorProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/looks" element={<LooksPage />} />
              <Route path="/looks/:slug" element={<LookDetail />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/neuheiten" element={<Neuheiten />} />
              <Route path="/sale" element={<Sale />} />
              <Route path="/product/:handle" element={<ProductDetail />} />
              <Route path="/marken" element={<MarkenIndex />} />
              <Route path="/marken/:slug" element={<MarkenDetail />} />
              <Route path="/magazin" element={<MagazinIndex />} />
              <Route path="/magazin/:slug" element={<MagazinDetail />} />
              <Route path="/groessentabellen" element={<Groessen />} />
              <Route path="/saison/:slug" element={<Saison />} />
              <Route path="/admin/import" element={<AdminImport />} />
              <Route path="/admin/looks" element={<AdminLooks />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SizeAdvisorProvider>
        </CartSyncBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
