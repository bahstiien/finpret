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
    <div role="radiogroup" aria-label={label} className="seg">
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
            className=""
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
