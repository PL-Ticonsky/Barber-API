import Image from "next/image";
import { Scissors } from "lucide-react";
export function DashboardIntro({ provider = false }: { provider?: boolean }) {
 return <section className={`dashboard-intro ${provider ? "provider-intro" : ""}`}><div><p className="overline"><Scissors size={16}/> {provider ? "EL OFICIO, BIEN ORGANIZADO" : "HAZTE UN ESPACIO"}</p><h1>{provider ? <>TU BARBERÍA.<br/><span>TODO EN ORDEN.</span></> : <>TU PRÓXIMO<br/><span>BUEN CORTE.</span></>}</h1><p>{provider ? "Tu agenda, tus horarios y cada cita en un mismo lugar." : "Elige tu momento. Nosotros ponemos el oficio."}</p></div><div className="dashboard-photo"><Image src="/images/barber-shop.jpg" alt="Sillones de una barbería clásica" fill sizes="(max-width:640px) 0px, 30vw"/><span>LA BUENA TIJERA <Scissors size={18}/></span></div></section>;
}
