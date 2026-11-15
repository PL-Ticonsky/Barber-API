"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Appointment, Me, Slot } from "@/lib/types";
import { fmtDateTimeLocal, fmtTimeLocal, providerToday, providerDate } from "@/lib/time";

import { DashboardIntro } from "@/components/dashboard-intro";
import { AppNavbar } from "@/components/app-navbar";
import { EmptyState } from "@/components/empty-state";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabel: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", canceled: "Cancelada" };

function statusBadgeVariant(s: string) {
  if (s === "confirmed") return "default";
  if (s === "pending") return "secondary";
  return "outline";
}

export default function ClientDashboard() {
  const [me, setMe] = useState<Me | null>(null);

  // Book tab
  const [date, setDate] = useState(() => providerToday()); // YYYY-MM-DD
  const slotMinutes = 30;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [desc, setDesc] = useState("Corte de cabello");
  const [createLoading, setCreateLoading] = useState(false);

  // My appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);

  // Cancel/reschedule modals
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [reschedule, setReschedule] = useState<{ id: string } | null>(null);
  const [rsDate, setRsDate] = useState(date);
  const [rsSlots, setRsSlots] = useState<Slot[]>([]);
  const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
  const [rsPick, setRsPick] = useState<Slot | null>(null);
  const [rsLoading, setRsLoading] = useState(false);

  const slotRequest = useRef(0);
  const rescheduleRequest = useRef(0);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }

    (async () => {
      try {
        const m = await api<Me>("/me");
        if (m.role !== "client") {
          window.location.href = m.role === "provider" ? "/provider" : "/login";
          return;
        }
        setMe(m);
        await loadAppointments();
      } catch {
        // api() ya maneja 401
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlots(d = date) {
    if (!d) return;
    const request = ++slotRequest.current;
    setSelectedSlot(null);
    setSlotsLoading(true);
    setSlots([]);
    try {
      const data = await api<Slot[]>(
        `/availability/slots?date=${encodeURIComponent(d)}&slot_minutes=${slotMinutes}`,
        { method: "GET" }
      );
      if (request !== slotRequest.current) return;
      setSlots(data);
      if (data.length === 0) toast.message("No hay turnos disponibles para este día");
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cargar los horarios."));
    } finally {
      if (request === slotRequest.current) setSlotsLoading(false);
    }
  }

  async function loadAppointments() {
    setApptsLoading(true);
    try {
      const data = await api<Appointment[]>("/me/appointments", { method: "GET" });
      setAppointments(data);
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cargar las citas."));
    } finally {
      setApptsLoading(false);
    }
  }

  async function createAppointment() {
    if (!selectedSlot || createLoading) return;
    setCreateLoading(true);

    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          start_at: selectedSlot.start_at,
          end_at: selectedSlot.end_at,
          description: desc?.trim() || null,
        }),
      });

      toast.success("Cita solicitada. Espera la confirmación del barbero.");
      setSelectedSlot(null);
      await Promise.all([loadAppointments(), loadSlots()]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Ese turno acaba de ocuparse. Elige otro horario.");
        setSelectedSlot(null);
        setRsPick(null);
        await loadSlots();
        if (reschedule) await loadRescheduleSlots(rsDate);
      }
      else if (err instanceof ApiError && err.status === 422 && errorMessage(err).includes("OUTSIDE_AVAILABILITY"))
        toast.error("Elige un turno dentro del horario de atención.");
      else if (err instanceof ApiError && err.status === 422 && errorMessage(err).includes("INVALID_TIME_RANGE"))
        toast.error("Revisa el horario de tu cita.");
      else toast.error(errorMessage(err, "No pudimos solicitar la cita."));
    } finally {
      setCreateLoading(false);
    }
  }

  async function cancelAppointment(id: string) {
    if (cancelLoading) return;
    setCancelLoading(true);
    try {
      await api(`/me/appointments/${id}/cancel`, { method: "PATCH" });
      toast.success("Cita cancelada. El horario vuelve a estar disponible.");
      setCancelId(null);
      await Promise.all([loadAppointments(), loadSlots()]);
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cancelar la cita."));
    } finally {
      setCancelLoading(false);
    }
  }

  async function loadRescheduleSlots(d: string) {
    if (!d || !reschedule) return;
    const request = ++rescheduleRequest.current;
    setRsSlotsLoading(true);
    setRsSlots([]);
    setRsPick(null);
    try {
      const data = await api<Slot[]>(
        `/availability/slots?date=${encodeURIComponent(d)}&slot_minutes=${slotMinutes}&exclude_appointment_id=${reschedule.id}`,
        { method: "GET" }
      );
      if (request !== rescheduleRequest.current) return;
      setRsSlots(data);
      if (data.length === 0) toast.message("No hay turnos disponibles para este día");
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos cargar los horarios."));
    } finally {
      if (request === rescheduleRequest.current) setRsSlotsLoading(false);
    }
  }

  async function doReschedule() {
    if (!reschedule || !rsPick || rsLoading) return;
    setRsLoading(true);
    try {
      await api(`/me/appointments/${reschedule.id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({
          start_at: rsPick.start_at,
          end_at: rsPick.end_at,
        }),
      });
      toast.success("Tu cita tiene un nuevo horario.");
      setReschedule(null);
      await Promise.all([loadAppointments(), loadSlots()]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Ese turno acaba de ocuparse. Elige otro horario.");
        setSelectedSlot(null);
        setRsPick(null);
        await loadSlots();
        if (reschedule) await loadRescheduleSlots(rsDate);
      }
      else toast.error(errorMessage(err, "No pudimos cambiar el horario."));
    } finally {
      setRsLoading(false);
    }
  }

  return (
    <div id="top" className="dashboard-shell">
      <AppNavbar title="Client" email={me?.email} />

      <main id="main-content" className="dashboard-page">
        <DashboardIntro/>
        <Tabs defaultValue="book" className="w-full">
          <TabsList>
            <TabsTrigger value="book">Reservar cita</TabsTrigger>
            <TabsTrigger value="mine">Mis citas</TabsTrigger>
          </TabsList>

          <TabsContent value="book" className="mt-6">
            <Card className="dashboard-panel">
              <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                <div className="grid gap-2">
                  <Label htmlFor="booking-date">Fecha</Label>
                  <Input
                    id="booking-date" type="date"
                    value={date}
                    min={providerToday()}
                    onChange={(e) => { ++slotRequest.current; setDate(e.target.value); setSelectedSlot(null); setSlots([]); setSlotsLoading(false); }}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="slot-duration">Duración del turno</Label>
                  <Input id="slot-duration" value={`${slotMinutes} minutos`} disabled />
                </div>

                <Button onClick={() => loadSlots(date)} disabled={slotsLoading}>
                  {slotsLoading ? "Cargando…" : "Ver horarios"}
                </Button>
              </div>

              <div className="mt-6">
                {slotsLoading ? (
                  <div className="slots-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <EmptyState
                    title="No hay turnos disponibles para este día"
                    description="Prueba otra fecha para encontrar tu próximo turno."
                  />
                ) : (
                  <div className="slots-grid">
                    {slots.map((s) => (
                      <Card
                        key={s.start_at}
                        className="slot-choice" role="button" tabIndex={0}
                        onKeyDown={(e) => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSlot(s); } }}
                        onClick={() => setSelectedSlot(s)}
                      >
                        <div className="text-lg font-semibold">
                          {fmtTimeLocal(s.start_at)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {fmtTimeLocal(s.start_at)} - {fmtTimeLocal(s.end_at)}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Dialog open={!!selectedSlot} onOpenChange={(o) => !o && setSelectedSlot(null)}>
              <DialogContent className="booking-dialog">
                <DialogHeader>
                  <DialogTitle>Tu próxima cita</DialogTitle>
                  <DialogDescription>Revisa los detalles antes de guardar los cambios.</DialogDescription>
                </DialogHeader>

                {selectedSlot ? (
                  <div className="grid gap-4">
                    <Card className="appointment-card">
                      <div className="text-sm text-muted-foreground">Tu horario</div>
                      <div className="font-medium">
                        {fmtDateTimeLocal(selectedSlot.start_at)} → {fmtDateTimeLocal(selectedSlot.end_at)}
                      </div>
                    </Card>

                    <div className="grid gap-2">
                      <Label>¿Qué corte tienes en mente? (opcional)</Label>
                      <Textarea
                        value={desc}
                        maxLength={500} onChange={(e) => setDesc(e.target.value)}
                        placeholder="Corte de cabello"
                      />
                    </div>
                  </div>
                ) : null}

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={createAppointment} disabled={createLoading}>
                    {createLoading ? "Solicitando…" : "Solicitar cita"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            <Card className="dashboard-panel">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Mis citas</div>
                  <div className="text-sm text-muted-foreground">
                    Puedes cambiar o cancelar tus citas mientras estén pendientes.
                  </div>
                </div>
                <Button variant="outline" onClick={loadAppointments} disabled={apptsLoading}>
                  Actualizar
                </Button>
              </div>

              <div className="mt-6 grid gap-3">
                {apptsLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                  </>
                ) : appointments.length === 0 ? (
                  <EmptyState title="Tu agenda tiene espacio" description="Reserva tu primera cita y empieza con buen pie." />
                ) : (
                  appointments.map((a) => (
                    <Card key={a.id} className="appointment-card">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {fmtDateTimeLocal(a.start_at)} → {fmtDateTimeLocal(a.end_at)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {a.description || "—"}
                            {a.cancel_reason && <p>Motivo de cancelación: {a.cancel_reason}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`status-badge status-${a.status}`} variant={statusBadgeVariant(a.status)}>{statusLabel[a.status]}</Badge>

                          {a.status === "pending" ? (
                            <>
                              <Button variant="outline" onClick={() => { ++rescheduleRequest.current; setRsSlots([]); setRsPick(null); setRsSlotsLoading(false); setRsDate(providerDate(a.start_at)); setReschedule({ id: a.id }); }}>
                                Cambiar horario
                              </Button>
                              <Button variant="destructive" onClick={() => setCancelId(a.id)}>
                                Cancelar
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            {/* Cancel modal */}
            <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
              <DialogContent className="booking-dialog">
                <DialogHeader>
                  <DialogTitle>¿Cancelamos esta cita?</DialogTitle>
                  <DialogDescription>Revisa los detalles antes de guardar los cambios.</DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">
                  El horario quedará libre para otra persona. Esta acción no se puede deshacer.
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setCancelId(null)}>
                    Conservar cita
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => cancelId && cancelAppointment(cancelId)}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? "Cancelando…" : "Cancelar cita"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Reschedule modal */}
            <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
              <DialogContent className="booking-dialog">
                <DialogHeader>
                  <DialogTitle>Cambiar horario</DialogTitle>
                  <DialogDescription>Revisa los detalles antes de guardar los cambios.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Nueva fecha</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={rsDate}
                        min={providerToday()}
                        onChange={(e) => { ++rescheduleRequest.current; setRsDate(e.target.value); setRsPick(null); setRsSlots([]); setRsSlotsLoading(false); }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => loadRescheduleSlots(rsDate)}
                        disabled={rsSlotsLoading}
                      >
                        {rsSlotsLoading ? "Cargando…" : "Ver horarios"}
                      </Button>
                    </div>
                  </div>

                  {rsSlotsLoading ? (
                    <div className="slots-grid">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-xl" />
                      ))}
                    </div>
                  ) : rsSlots.length === 0 ? (
                    <EmptyState title="Todavía no hay turnos para mostrar" description="Prueba otra fecha para encontrar tu próximo turno." />
                  ) : (
                    <div className="slots-grid">
                      {rsSlots.map((s) => {
                        const active = rsPick?.start_at === s.start_at;
                        return (
                          <Card
                            key={s.start_at}
                            role="button" tabIndex={0} aria-pressed={active} onKeyDown={(e) => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); setRsPick(s); } }} className={`slot-choice ${
                              active ? "slot-selected" : ""
                            }`}
                            onClick={() => setRsPick(s)}
                          >
                            <div className="text-lg font-semibold">
                              {fmtTimeLocal(s.start_at)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {fmtTimeLocal(s.start_at)} - {fmtTimeLocal(s.end_at)}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setReschedule(null)}>
                    Cerrar
                  </Button>
                  <Button onClick={doReschedule} disabled={!rsPick || rsLoading}>
                    {rsLoading ? "Guardando…" : "Guardar nuevo horario"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
