import Link from "next/link";
import { Scissors } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand-lockup ${light ? "brand-light" : ""}`} aria-label="La Buena Tijera, inicio">
    <span className="brand-icon"><Scissors strokeWidth={1.5} aria-hidden="true" /></span>
    <span><strong>LA BUENA TIJERA</strong><small>BARBERÍA & BUEN ESTILO</small></span>
  </Link>;
}
