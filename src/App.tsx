import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCartSync } from "@/hooks/useCartSync";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import LooksPage from "./pages/Looks.tsx";
import LookDetail from "./pages/LookDetail.tsx";
import Shop from "./pages/Shop.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import AnlassPage from "./pages/Anlass.tsx";
import { MarkenDetail, MarkenIndex } from "./pages/Marken.tsx";
import { MagazinDetail, MagazinIndex } from "./pages/Magazin.tsx";

const queryClient = new QueryClient();

const CartSyncBoundary = ({ children }: { children: React.ReactNode }) => {
  useCartSync();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <CartSyncBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/looks" element={<LooksPage />} />
            <Route path="/looks/:slug" element={<LookDetail />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:handle" element={<ProductDetail />} />
            <Route path="/anlass/:slug" element={<AnlassPage />} />
            <Route path="/marken" element={<MarkenIndex />} />
            <Route path="/marken/:slug" element={<MarkenDetail />} />
            <Route path="/magazin" element={<MagazinIndex />} />
            <Route path="/magazin/:slug" element={<MagazinDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartSyncBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
