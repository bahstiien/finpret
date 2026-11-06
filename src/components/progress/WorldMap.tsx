import { countryTone } from "@/components/ui/Stamp";
import type { CountryEntry } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { WORLD_MAP } from "./world-map-data";

const t = fr.progress.passport.map;
const INK = "var(--ink-fixed)";
/** Sous cette surface (px² dans le repère 500 × 220), un pays reçoit un repère pour rester visible. */
const TINY = 30;

/** Couleur du tampon d'un pays (même ton que son tampon du passeport). */
const stampColor = (code: string) => `var(--${countryTone(code.toUpperCase()).replace("tone-", "")})`;

/**
 * Mappemonde du passeport (maquette Nos progrès) : pays tamponnés à la couleur de leur tampon, pays à gagner hachurés,
 * hors passeport en blanc, cercle sur le dernier tamponné. C'est une image (texte alternatif complet) : sur mobile
 * l'Europe fait quelques pixels, le tap passe par les tampons juste en dessous.
 */
export function WorldMap({ countries }: { countries: CountryEntry[] }) {
  const earned = countries.filter((c) => c.earned);
  const latest = earned.reduce((m, c) => ((c.firstCookedOn ?? "") > m ? (c.firstCookedOn ?? "") : m), "");
  const newest = latest ? earned.filter((c) => c.firstCookedOn === latest) : [];
  const drawn = countries.filter((c) => WORLD_MAP.countries[c.code]);
  const inPassport = new Set(countries.map((c) => c.code));
  const outside = Object.entries(WORLD_MAP.countries).filter(([code]) => !inPassport.has(code));
  const toEarn = countries.filter((c) => !c.earned);

  const alt = [
    t.alt,
    earned.length
      ? t.altEarned(
          earned.length,
          earned.map((c) => c.label).join(", "),
          newest.map((c) => c.label).join(", "),
        )
      : t.altNone,
    toEarn.length ? t.altToEarn(toEarn.length, toEarn.map((c) => c.label).join(", ")) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2" data-testid="passport-map">
      <svg
        viewBox={`0 0 ${WORLD_MAP.w} ${WORLD_MAP.h}`}
        role="img"
        aria-label={alt}
        className="block h-auto w-full"
      >
        <defs>
          <pattern id="passport-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="#fff" />
            <rect width="1.3" height="4" fill={INK} />
          </pattern>
        </defs>
        <path d={WORLD_MAP.rest} fill="#fff" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {outside.map(([code, p]) => (
          <path key={code} d={p.d} fill="#fff" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {drawn.map((c) => (
          <path
            key={c.code}
            d={WORLD_MAP.countries[c.code]!.d}
            data-country={c.code}
            data-state={c.earned ? "earned" : "empty"}
            fill={c.earned ? stampColor(c.code) : "url(#passport-hatch)"}
            stroke={INK}
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {drawn
          .filter((c) => WORLD_MAP.countries[c.code]!.a < TINY)
          .map((c) => {
            const p = WORLD_MAP.countries[c.code]!;
            return c.earned ? (
              <circle key={c.code} cx={p.cx} cy={p.cy} r={3.2} fill={stampColor(c.code)} stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            ) : (
              <circle
                key={c.code}
                cx={p.cx}
                cy={p.cy}
                r={2.6}
                fill="#fff"
                stroke={INK}
                strokeWidth={1.2}
                strokeDasharray="2 1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        {newest
          .filter((c) => WORLD_MAP.countries[c.code])
          .map((c) => {
            const p = WORLD_MAP.countries[c.code]!;
            return <circle key={c.code} cx={p.cx} cy={p.cy} r={11} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />;
          })}
      </svg>
      <figcaption aria-hidden="true" className="t-small flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="box-border h-3 w-[18px] border-2 border-[var(--ink-fixed)]"
            style={{ background: "linear-gradient(90deg, var(--blue) 0 33%, var(--green) 33% 66%, var(--pink) 66%)" }}
          />
          {t.legendEarned}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="box-border h-3 w-[18px] border-2 border-[var(--ink-fixed)]"
            style={{ background: "repeating-linear-gradient(45deg, var(--ink-fixed) 0 1.5px, #fff 1.5px 4px)" }}
          />
          {t.legendToEarn}
        </span>
        {newest.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="box-border size-3.5 rounded-full border-2 border-[var(--ink-fixed)]" />
            {t.legendNew}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
