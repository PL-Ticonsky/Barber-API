import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
const TZ = process.env.NEXT_PUBLIC_PROVIDER_TZ || "America/Bogota";
export function fmtDateTimeLocal(iso: string) { return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd HH:mm"); }
export function fmtTimeLocal(iso: string) { return formatInTimeZone(new Date(iso), TZ, "HH:mm"); }
export function providerToday() { return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd"); }
export function providerDate(iso: string) { return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd"); }
export function providerDayBoundary(day: string, end = false) {
  return fromZonedTime(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}`, TZ).toISOString();
}
