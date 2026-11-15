"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Appointment, Me } from "@/lib/types";
import { fmtDateTimeLocal, providerDayBoundary } from "@/lib/time";

import { DashboardIntro } from "@/components/dashboard-intro";
import { AppNavbar } from "@/components/app-navbar";
import { ProviderSidebar } from "@/components/provider-sidebar";
import { EmptyState } from "@/components/empty-state";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "pending" | "confirmed" | "canceled";

const statusLabel: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", canceled: "Cancelada" };

function statusBadgeVariant(s: string) {
  if (s === "confirmed") return "default";
  if (s === "pending") return "secondary";
  return "outline";
}

type AvailabilityBlock = {
  weekday: number; // 0=Mon ... 6=Sun (puedes adaptar si tu backend define otro mapping)
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
};

const weekdays = [
  { k: 0, label: "Lunes" },
  { k: 1, label: "Martes" },
  { k: 2, label: "Miércoles" },
  { k: 3, label: "Jueves" },
  { k: 4, label: "Viernes" },
  { k: 5, label: "Sábado" },
  { k: 6, label: "Domingo" },
];

export default function ProviderDashboard() {
  const [me, setMe] = useState<Me | null>(null);


  const [view, setView] = useState<"appointments" | "availability">("appointments");

  // appointments
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const [cancel, setCancel] = useState<{ id: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [confirmLoadingId, setConfirmLoadingId] = useState<string | null>(null);

  // availability
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [saveAvailLoading, setSaveAvailLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }

    (async () => {
      try {
        const m = await api<Me>("/me");
        if (m.role !== "provider") {
          window.location.href = m.role === "client" ? "/client" : "/login";
          return;
        }
        setMe(m);
        await Promise.all([loadAppointments(), loadAvailability()]);
      } catch {
        // api() maneja 401
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAvailability() {
    setAvailabilityLoading(true); setAvailabilityLoaded(false); setAvailabilityError("");
    try {
      const data = await api<(AvailabilityBlock & { is_active: boolean })[]>("/barber/availability");
      setBlocks(data.filter(b => b.is_active).map(b => ({ weekday: b.weekday, start_time: b.start_time, end_time: b.end_time })));
      setAvailabilityLoaded(true);
    } catch (error) { setAvailabilityError(errorMessage(error, "No pudimos cargar los horarios guardados.")); }
    finally { setAvailabilityLoading(false); }
  }

  async function loadAppointments() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("status_", status);
      if (from && to && from > to) throw new Error("La fecha inicial debe ser anterior a la final.");
      if (from) qs.set("from", providerDayBoundary(from));
      if (to) qs.set("to", providerDayBoundary(to, true));

      const data = await api<Appointment[]>(
        `/barber/appointments?${qs.toString()}`,
        { method: "GET" }
      );
      setItems(data);
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cargar las citas."));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(id: string) {
    if (confirmLoadingId) return;
    setConfirmLoadingId(id);
    try {
      await api(`/barber/appointments/${id}/confirm`, { method: "PATCH" });
      toast.success("Cita confirmada.");
      await loadAppointments();
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos confirmar la cita."));
    } finally {
      setConfirmLoadingId(null);
    }
  }

  async function cancelAppointment() {
    if (!cancel || cancelLoading) return;
    setCancelLoading(true);
    try {
      await api(`/barber/appointments/${cancel.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify(cancelReason?.trim() ? { reason: cancelReason.trim() } : {}),
      });
      toast.success("Cita cancelada.");
      setCancel(null);
      setCancelReason("");
      await loadAppointments();
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cancelar la cita."));
    } finally {
      setCancelLoading(false);
    }
  }

  function addBlock(day: number) {
    setBlocks((prev) => [...prev, { weekday: day, start_time: "09:00", end_time: "18:00" }]);
  }

  function updateBlock(idx: number, patch: Partial<AvailabilityBlock>) {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveAvailability() {
    if (saveAvailLoading || !availabilityLoaded || availabilityLoading) return;

    // validación mínima UX
    for (const b of blocks) {
      if (!b.start_time || !b.end_time) {
        toast.error("Completa las horas de inicio y fin.");
        return;
      }
      if (b.start_time >= b.end_time) {
        toast.error("La hora de inicio debe ser anterior al final.");
        return;
      }
    }

    setSaveAvailLoading(true);
    try {
      await api("/barber/availability/bulk", {
        method: "POST",
        body: JSON.stringify(blocks),
      });
      toast.success("Tus horarios quedaron guardados.");
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos guardar tus horarios."));
    } finally {
      setSaveAvailLoading(false);
    }
  }

  return (
    <div id="top" className="dashboard-shell">
      <AppNavbar title="Provider" email={me?.email} />

      <main id="main-content" className="dashboard-page">
        <DashboardIntro provider/>
        <div className="provider-layout">
          <ProviderSidebar active={view} onChange={setView} />

          <div className="provider-content">
            {view === "appointments" ? (
              <Card className="dashboard-panel">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-lg font-semibold">Agenda de citas</div>
                    <div className="text-sm text-muted-foreground">
                      Cada cliente, a su tiempo. Filtra y organiza las citas de tu barbería.
                    </div>
                  </div>

                  <div className="provider-filters">
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendientes</SelectItem>
                          <SelectItem value="confirmed">Confirmadas</SelectItem>
                          <SelectItem value="canceled">Canceladas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Desde (opcional)</Label>
                      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" />
                    </div>

                    <div className="grid gap-2">
                      <Label>Hasta (opcional)</Label>
                      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="YYYY-MM-DD" />
                    </div>

                    <Button onClick={loadAppointments} disabled={loading}>
                      {loading ? "Cargando…" : "Aplicar filtros"}
                    </Button>
                  </div>

                  <div className="mt-2 grid gap-3">
                    {loading ? (
                      <>
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                      </>
                    ) : items.length === 0 ? (
                      <EmptyState title="Tu agenda tiene espacio" />
                    ) : (
                      items.map((a) => (
                        <Card key={a.id} className="appointment-card">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="font-medium">
                                {fmtDateTimeLocal(a.start_at)} → {fmtDateTimeLocal(a.end_at)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Cliente · {a.client_id?.slice(0, 8) || "—"} · {a.description || "—"}
                            {a.cancel_reason && <p>Motivo de cancelación: {a.cancel_reason}</p>}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`status-badge status-${a.status}`} variant={statusBadgeVariant(a.status)}>{statusLabel[a.status]}</Badge>

                              {a.status === "pending" ? (
                                <>
                                  <Button
                                    onClick={() => confirm(a.id)}
                                    disabled={confirmLoadingId === a.id}
                                  >
                                    {confirmLoadingId === a.id ? "Confirmando…" : "Confirmar"}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => setCancel({ id: a.id })}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : a.status === "confirmed" ? (
                                <Button
                                  variant="destructive"
                                  onClick={() => setCancel({ id: a.id })}
                                >
                                  Cancelar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                <Dialog open={!!cancel} onOpenChange={(o) => !o && setCancel(null)}>
                  <DialogContent className="booking-dialog">
                    <DialogHeader>
                      <DialogTitle>Cancelar cita</DialogTitle>
                  <DialogDescription>Revisa los detalles antes de guardar los cambios.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                      <Label>Motivo (opcional)</Label>
                      <Textarea
                        value={cancelReason}
                        maxLength={500} onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Cuéntale al cliente el motivo…"
                      />
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setCancel(null)}>
                        Cerrar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={cancelAppointment}
                        disabled={cancelLoading}
                      >
                        {cancelLoading ? "Cancelando…" : "Cancelar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            ) : (
              <Card className="dashboard-panel">
                <div>
                  <div className="text-lg font-semibold">Horarios de atención</div>
                  <div className="text-sm text-muted-foreground">
                    Define cuándo recibes clientes. Los cambios se aplican a las próximas reservas.
                  </div>
                </div>

                {availabilityLoading && <p role="status">Cargando tus horarios guardados…</p>}
                {availabilityError && <div role="alert"><p>{availabilityError}</p><Button onClick={loadAvailability}>Reintentar carga</Button></div>}
                <fieldset disabled={!availabilityLoaded || availabilityLoading || saveAvailLoading} className="mt-6 grid gap-4">
                  {weekdays.map((d) => {
                    const dayBlocks = blocks
                      .map((b, idx) => ({ b, idx }))
                      .filter((x) => x.b.weekday === d.k);

                    return (
                      <Card key={d.k} className="appointment-card">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{d.label}</div>
                          <Button variant="outline" onClick={() => addBlock(d.k)}>
                            Añadir horario
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {dayBlocks.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Sin atención programada.
                            </div>
                          ) : (
                            dayBlocks.map(({ b, idx }) => (
                              <div key={idx} className="availability-row">
                                <div className="availability-time">
                                  <Label>Desde</Label>
                                  <Input
                                    type="time" step="1" value={b.start_time}
                                    onChange={(e) => updateBlock(idx, { start_time: e.target.value })}
                                    placeholder="09:00"
                                  />
                                </div>
                                <div className="availability-time">
                                  <Label>Hasta</Label>
                                  <Input
                                    type="time" step="1" value={b.end_time}
                                    onChange={(e) => updateBlock(idx, { end_time: e.target.value })}
                                    placeholder="18:00"
                                  />
                                </div>
                                <div className="availability-remove">
                                  <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => removeBlock(idx)}
                                  >
                                    Eliminar
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </fieldset>

                <div className="mt-6 flex justify-end">
                  <Button onClick={saveAvailability} disabled={saveAvailLoading || !availabilityLoaded || availabilityLoading}>
                    {saveAvailLoading ? "Guardando…" : "Guardar horarios"}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
