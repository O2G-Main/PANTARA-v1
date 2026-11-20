import { useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { monthName } from "@/lib/hr/overview";

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  return <div className="field"><span>Bulan penilaian</span>
    <button ref={trigger} type="button" className="input date-trigger" popoverTarget={id} aria-haspopup="dialog" aria-label={"Bulan penilaian, " + monthName(value)} onClick={() => setYear(Number(value.slice(0, 4)))}>
      {monthName(value)}<CalendarDays size={16} /></button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label="Pilih bulan" className="date-pop" onToggle={event => {
      const box = trigger.current?.getBoundingClientRect();
      const el = panel.current;
      if (!box || !el || event.newState !== "open") return;
      el.style.left = Math.max(8, Math.min(box.left, innerWidth - el.offsetWidth - 8)) + "px";
      el.style.top = Math.max(8, Math.min(box.bottom + 6, innerHeight - el.offsetHeight - 8)) + "px";
      el.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    }}>
      <div className="date-head"><strong aria-live="polite">{year}</strong><span>{[-1, 1].map(step => <button key={step} type="button" className="icon-button subtle" aria-label={step < 0 ? "Tahun sebelumnya" : "Tahun berikutnya"} onClick={() => setYear(year + step)}>{step < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>)}</span></div>
      <div className="hr-month-grid">{Array.from({ length: 12 }, (_, index) => {
        const month = year + "-" + String(index + 1).padStart(2, "0");
        return <button key={month} type="button" aria-pressed={month === value} onClick={() => { onChange(month); panel.current?.hidePopover(); trigger.current?.focus(); }}>{monthName(month).split(" ")[0]}</button>;
      })}</div>
    </div></div>;
}
