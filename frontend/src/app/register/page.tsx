"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";

import { AuthShell } from "@/components/auth-shell";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
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
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      toast.success("Cuenta creada. Ya puedes iniciar sesión.");
      window.location.href = "/login";
    } catch (err) {
      setFormError(errorMessage(err, "No pudimos crear la cuenta. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell register><div className="auth-form-inner"><p className="overline">BIENVENIDO AL CLUB</p><h1>TU PRIMER<br/>BUEN PASO.</h1><p className="auth-description">Crea tu cuenta y encuentra un momento para ti.</p><form onSubmit={onSubmit} className="auth-form"><div className="auth-field"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} required/></div><div className="auth-field"><Label htmlFor="password">Contraseña</Label><div className="password-field"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Al menos 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}/><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><small>Usa al menos 8 caracteres. Nunca compartas tu contraseña.</small></div>{formError && <p role="alert" className="auth-error">{formError}</p>}<Button type="submit" disabled={loading} className="auth-submit">{loading ? "Creando tu cuenta…" : "CREAR MI CUENTA"}<ArrowUpRight size={18}/></Button></form><div className="auth-switch"><span>¿Ya tienes cuenta?</span> <Link href="/login">Inicia sesión <ArrowUpRight size={15}/></Link></div></div></AuthShell>;
}
