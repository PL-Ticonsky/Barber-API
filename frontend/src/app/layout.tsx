import type { Metadata } from "next";
import "./globals.css";
import { ClientToaster } from "@/components/client-toaster";
export const metadata: Metadata = {
  title: { default: "La Buena Tijera — Barbería & buen estilo", template: "%s · La Buena Tijera" },
  description: "Cortes clásicos, estilo propio. Reserva tu próxima cita y gestiona tus horarios en La Buena Tijera.",
  icons: { icon: "/brand-icon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body><a className="skip-link" href="#main-content">Saltar al contenido</a>{children}<ClientToaster/></body></html>;
}
