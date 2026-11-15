import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { Brand } from "@/components/brand";
export function AuthShell({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  return <div id="top" className="auth-page"><header className="auth-header"><Brand/><Link href="/" className="back-link"><ArrowLeft size={16}/> Volver a la barbería</Link></header><main id="main-content" className="auth-main"><section className="auth-photo"><Image src={register ? "/images/barber-shop.jpg" : "/images/barber-cut.jpg"} alt={register ? "Interior de una barbería de estilo clásico" : "Barbero trabajando en un corte de cabello"} fill priority sizes="(max-width:760px) 100vw, 50vw"/><div className="auth-photo-copy"><span className="auth-stamp"><Scissors size={27}/></span><p className="overline">LA BUENA TIJERA</p><h2>{register ? <>TU ESTILO.<br/>TU LUGAR.</> : <>DE VUELTA<br/>AL BUEN ESTILO.</>}</h2><p>El encanto de siempre.<br/>Tu próxima cita, a un clic.</p></div></section><section className="auth-form-area">{children}<p className="auth-footnote"><Scissors size={14}/> CORTES CLÁSICOS. CONEXIONES SENCILLAS.</p></section></main><div className="auth-bottom"><span>LA BUENA TIJERA · BARBERÍA & BUEN ESTILO</span><Link href="/creditos">Concepto de portafolio · Créditos</Link></div></div>;
}
