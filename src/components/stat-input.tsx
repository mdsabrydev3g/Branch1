import { useEffect, useState } from "react";
import { formatNumber, parseLoose } from "@/lib/domain";
import { Input } from "@/components/ui/input";

export function StatInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium tracking-wide text-subtle">
        {label}
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={focused ? draft : formatNumber(value)}
        onFocus={() => {
          if (disabled) return;
          setFocused(true);
          setDraft(value ? String(value) : "");
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (disabled) return;
          setFocused(false);
          onChange(parseLoose(draft));
        }}
        disabled={disabled}
        className="tabular-nums"
      />
    </label>
  );
}
