"use client";

/** Sélecteur segmenté (2 à 4 choix) : un seul choix actif, navigation aux flèches, zone de 44 px. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-r2 border-[length:var(--bw)] border-line bg-chip p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              const dir =
                e.key === "ArrowRight" || e.key === "ArrowDown"
                  ? 1
                  : e.key === "ArrowLeft" || e.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!dir) return;
              e.preventDefault();
              onChange(options[(i + dir + options.length) % options.length]!.value);
            }}
            className={`min-h-11 rounded-r1 px-4 text-sm font-bold uppercase transition duration-90 ease-base ${
              active ? "bg-violet text-white" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
