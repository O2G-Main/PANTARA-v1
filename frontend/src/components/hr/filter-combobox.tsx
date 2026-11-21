// Adapted from anubra266/combobox on 21st.dev.
import { Combobox } from "@ark-ui/react/combobox";
import { createListCollection } from "@ark-ui/react/collection";
import { ChevronDown } from "lucide-react";

export function FilterCombobox({ label, placeholder, options, value, onChange }: {
  label: string; placeholder: string; options: { label: string; detail?: string }[];
  value: string; onChange: (value: string) => void;
}) {
  const collection = createListCollection({
    items: options.filter(item => (item.label + " " + (item.detail ?? "")).toLowerCase().includes(value.toLowerCase())),
    itemToString: item => item.label,
    itemToValue: item => item.label,
  });
  return <Combobox.Root className="field" collection={collection} inputValue={value} allowCustomValue
    openOnClick onInputValueChange={event => onChange(event.inputValue)}
    onValueChange={event => onChange(event.value[0] ?? "")}>
    <Combobox.Label>{label}</Combobox.Label>
    <Combobox.Control className="relative"><Combobox.Input className="w-full" placeholder={placeholder} />
      <Combobox.Trigger type="button" className="absolute right-2 top-1/2 -translate-y-1/2" aria-label={"Pilihan " + label}><ChevronDown size={16} /></Combobox.Trigger>
    </Combobox.Control>
    <Combobox.Positioner style={{ zIndex: 10 }}><Combobox.Content className="hr-options">
      {collection.items.map(item => <Combobox.Item key={item.label + item.detail} item={item}><Combobox.ItemText>{item.label}</Combobox.ItemText>{item.detail && <small>{item.detail}</small>}</Combobox.Item>)}
      {!collection.items.length && <p>Tidak ada pilihan yang cocok.</p>}
    </Combobox.Content></Combobox.Positioner>
  </Combobox.Root>;
}

export const employmentChoices = { karyawan: "Karyawan", freelancer: "Freelancer" };

export function Choice({ label, choices, value, onChange }: {
  label: string; choices: Record<string, string>; value: string; onChange: (value: string) => void;
}) {
  const collection = createListCollection({ items: Object.entries(choices).map(([key, label]) => ({ value: key, label })) });
  return <Combobox.Root className="field" collection={collection} value={[value]} inputValue={choices[value] ?? ""}
    openOnClick onValueChange={event => onChange(event.value[0] ?? "")}>
    <Combobox.Label>{label}</Combobox.Label><Combobox.Control className="relative"><Combobox.Input readOnly className="w-full" />
      <Combobox.Trigger type="button" aria-label={"Pilihan " + label} className="absolute right-2 top-1/2 -translate-y-1/2"><ChevronDown size={16} /></Combobox.Trigger></Combobox.Control>
    <Combobox.Positioner style={{ zIndex: 20 }}><Combobox.Content className="hr-options">{collection.items.map(item =>
      <Combobox.Item key={item.value} item={item}><Combobox.ItemText>{item.label}</Combobox.ItemText></Combobox.Item>)}</Combobox.Content></Combobox.Positioner>
  </Combobox.Root>;
}
