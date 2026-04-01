import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import LocationPrompt from "@/components/ui/LocationPrompt";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Puebleando – Experiencias auténticas en Guadalajara",
  description:
    "Descubre taquerías, talleres artesanales, mercados locales y rincones escondidos de Guadalajara y alrededores.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff4f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Navbar />
          <LocationPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
