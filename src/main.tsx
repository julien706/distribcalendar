import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nouvelle version disponible. Mettre à jour ?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("L'application est prête à fonctionner hors ligne");
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
