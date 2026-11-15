"use client";
import { CalendarDays, Clock3, Scissors } from "lucide-react";
export function ProviderSidebar({ active, onChange }: { active: "appointments" | "availability"; onChange: (v: "appointments" | "availability") => void }) {
 return <aside className="provider-sidebar"><p className="overline">TU BARBERÍA</p><button className={active === "appointments" ? "active" : ""} aria-pressed={active === "appointments"} onClick={() => onChange("appointments")}><CalendarDays size={18}/> Agenda de citas</button><button className={active === "availability" ? "active" : ""} aria-pressed={active === "availability"} onClick={() => onChange("availability")}><Clock3 size={18}/> Horarios de atención</button><div className="sidebar-note"><Scissors size={27}/><strong>EL BUEN OFICIO<br/>EMPIEZA CON ORDEN.</strong><p>Organiza tus horarios y deja que cada cita encuentre su lugar.</p></div></aside>;
}
