"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="announcement"><span>BUEN CORTE. BUENA ACTITUD.</span><span>BARBERÍA CLÁSICA · RESERVAS ONLINE</span></div>
    <header className="site-header">
      <Brand />
      <button className="mobile-menu" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav id="site-nav" className={open ? "site-nav open" : "site-nav"} aria-label="Navegación principal">
        <a href="/#servicios" onClick={() => setOpen(false)}>Nuestros cortes</a>
        <a href="/#el-oficio" onClick={() => setOpen(false)}>El oficio</a>
        <a href="/#como-reservar" onClick={() => setOpen(false)}>Cómo reservar</a>
        <Link href="/login" className="nav-account">Mi cuenta</Link>
        <Link href="/login" className="v-button coral">RESERVAR MI CITA <ArrowUpRight size={17} /></Link>
      </nav>
    </header>
  </>;
}
