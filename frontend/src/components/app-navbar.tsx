"use client";
import Link from "next/link";
import { LogOut, ArrowUpRight } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { Brand } from "@/components/brand";
export function AppNavbar({ title = "Client", email }: { title?: string; email?: string }) {
  return <header className="app-navbar"><Brand light/><span className="workspace-label">{title === "Provider" ? "EL ESCRITORIO DEL BARBERO" : "TU ESPACIO PERSONAL"}</span><div className="app-navbar-actions"><Link href="/" className="home-link">La barbería <ArrowUpRight size={15}/></Link><span className="account-email" title={email}>{email || "Cargando cuenta…"}</span><button onClick={() => { clearToken(); window.location.href = "/login"; }} className="logout-button"><LogOut size={16}/><span>Salir</span></button></div></header>;
}
