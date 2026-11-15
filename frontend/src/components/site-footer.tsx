import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowUpRight } from "lucide-react";
export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-main"><div><Brand light /><p>De la vieja escuela.<br />Con tu propia actitud.</p></div><div className="footer-links"><span>EL SIGUIENTE PASO</span><Link href="/login">Reservar una cita <ArrowUpRight size={16} /></Link><Link href="/register">Crear mi cuenta <ArrowUpRight size={16} /></Link><Link href="/login">Ver mis reservas <ArrowUpRight size={16} /></Link></div><div className="footer-statement">EL ESTILO<br />ES TUYO<span>✦</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} LA BUENA TIJERA · CONCEPTO DE PORTAFOLIO</span><Link href="/creditos">Créditos fotográficos</Link><a href="#top">VOLVER ARRIBA ↑</a></div></footer>;
}
