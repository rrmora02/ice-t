import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { InstallPrompt } from "@/components/install-prompt";
import { FeedbackProvider } from "@/components/ui/feedback";
import "./globals.css";

// Nota: se usa la pila de fuentes del sistema (ver --font-sans en
// globals.css) en vez de next/font/google a propósito: evita una
// dependencia de red en el arranque (más rápido, funciona sin conexión
// para la carga inicial de la PWA, y sortea builds en redes restringidas
// donde fonts.googleapis.com no es alcanzable).

export const metadata: Metadata = {
  title: "Ice-T · Control de venta de hielo",
  description: "Control de ventas, clientes, precios, gastos y recordatorios de reabasto de hielo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ice-T",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0284c7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Provider en la raíz para que toasts y confirmaciones estén
            disponibles en toda la app, incluidas las pantallas de auth. */}
        <FeedbackProvider>
          {children}
          <ServiceWorkerRegistrar />
          <InstallPrompt />
        </FeedbackProvider>
      </body>
    </html>
  );
}
