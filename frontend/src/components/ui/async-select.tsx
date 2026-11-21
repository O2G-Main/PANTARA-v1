"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Icon } from "@/components/ui";

interface AsyncSelectProps<T> {
  fetcher: (query: string) => Promise<T[]>;
  getOptionValue: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  placeholder?: string;
  noResultsMessage?: string;
}

export function AsyncSelect<T>({ fetcher, getOptionValue, renderOption, value, onChange, label, placeholder = "Cari...", noResultsMessage = "Tidak ada hasil." }: AsyncSelectProps<T>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetcher(query).then((items) => {
        if (active) setOptions(items);
      }).catch(() => {
        if (active) setError("Daftar anggota gagal dimuat.");
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 150);
    return () => { window.clearTimeout(timer); active = false; };
  }, [fetcher, query]);

  return <div>
    <span className="field-label">{label}</span>
    <details className="hr-select" onKeyDown={event => {
      if (event.key === "Escape" && event.currentTarget.open) {
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary className="hr-select-trigger">{value.length ? `${value.length} anggota dipilih` : "Pilih anggota"}<Icon icon={ChevronDown} size={18} /></summary>
      <div className="hr-select-panel">
    <label className="field" htmlFor={id}><span className="sr-only">{label}</span>
      <span className="search-field w-full"><Icon icon={Search} size={16} /><input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></span>
    </label>
    <div className="my-4 max-h-60 overflow-y-auto rounded-2xl border border-border bg-surface" aria-busy={loading}>
      {error ? <p className="p-4 text-sm" role="alert">{error}</p> : loading && !options.length ? <p className="p-4 text-sm muted" role="status">Memuat anggota...</p> : options.length ? options.map((option) => {
        const optionValue = getOptionValue(option);
        return <label key={optionValue} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent-soft">
          <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" checked={value.includes(optionValue)} onChange={(event) => onChange(event.target.checked ? [...value, optionValue] : value.filter((item) => item !== optionValue))} />
          <span className="min-w-0 flex-1">{renderOption(option)}</span>
        </label>;
      }) : <p className="p-4 text-sm muted">{noResultsMessage}</p>}
    </div>
      </div>
    </details>
  </div>;
}
