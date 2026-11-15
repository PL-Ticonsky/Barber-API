import { CalendarDays } from "lucide-react";
export function EmptyState({ title, description }: { title: string; description?: string }) {
 return <div className="empty-state"><span><CalendarDays size={29} strokeWidth={1.4}/></span><h3>{title}</h3>{description && <p>{description}</p>}</div>;
}
