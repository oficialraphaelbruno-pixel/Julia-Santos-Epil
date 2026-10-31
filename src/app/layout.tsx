import type { Metadata, Viewport } from "next";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { Toaster } from "sonner";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Julia Santos Epil | Epilação e cuidados",
    template: "%s | Julia Santos Epil",
  },
  description:
    "Agende seu atendimento com praticidade e reserve um momento especial de cuidado para você. Julia Santos Epil — epilação, estética e cuidados pessoais.",
  applicationName: "Julia Santos Epil",
  appleWebApp: { capable: true, title: "Julia Santos", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Julia Santos Epil",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-line !bg-white !text-ink !shadow-lg !font-sans",
              description: "!text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
