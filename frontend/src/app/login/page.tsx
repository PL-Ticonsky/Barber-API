"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Me } from "@/lib/types";

import { AuthShell } from "@/components/auth-shell";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError("");
    setLoading(true);
    try {
      const res = await api<{ access_token: string; token_type: string }>(
        "/auth/login",
        {
          method: "POST",
          auth: false,
          body: JSON.stringify({ email, password }),
        }
      );

      setToken(res.access_token);

      const me = await api<Me>("/me", { method: "GET" });

      toast.success("Bienvenido a La Buena Tijera");
      window.location.href = me.role === "provider" ? "/provider" : "/client";
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (err instanceof ApiError && err.status === 401 && String(code).includes("INVALID_CREDENTIALS")) {
        setFormError("El correo o la contraseña no son correctos.");
      } else {
        setFormError(errorMessage(err, "No pudimos iniciar sesión. Inténtalo de nuevo."));
      }
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell><div className="auth-form-inner"><p className="overline">EL BUEN ESTILO TE ESPERA</p><h1>QUÉ BUENO<br/>VERTE DE NUEVO.</h1><p className="auth-description">Entra a tu cuenta. Tu próximo corte te espera.</p><form onSubmit={onSubmit} className="auth-form"><div className="auth-field"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} required/></div><div className="auth-field"><Label htmlFor="password">Contraseña</Label><div className="password-field"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} required/><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>{formError && <p role="alert" className="auth-error">{formError}</p>}<Button type="submit" disabled={loading} className="auth-submit">{loading ? "Entrando…" : "ENTRAR A MI CUENTA"}<ArrowUpRight size={18}/></Button></form><div className="auth-switch"><span>¿Primera vez por aquí?</span> <Link href="/register">Crea tu cuenta <ArrowUpRight size={15}/></Link></div></div></AuthShell>;
}
