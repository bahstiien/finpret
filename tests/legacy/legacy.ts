// Banc de fidélité : exécute le prototype (reference/menu-legacy.html) dans une machine virtuelle Node,
// avec un DOM factice et un tirage aléatoire à graine. Sert de référence aux tests du moteur porté.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { seededRandom } from "@/engine/random";

/** Objet factice universel : toute propriété existe, tout appel renvoie un objet factice. */
function stub(): unknown {
  return new Proxy(function () {}, {
    get: (_t, p) =>
      p === Symbol.toPrimitive
        ? () => ""
        : p === "length"
          ? 0
          : p === Symbol.iterator
            ? function* () {}
            : p === "then"
              ? undefined
              : stub(),
    apply: () => stub(),
    construct: () => stub() as object,
    set: () => true,
  });
}

export type LegacySettings = {
  light: number;
  pasta: number;
  comfort: number;
  world: number;
  bankUse: number;
  skip: string[];
  gateau?: boolean;
  kid?: number;
};

export type LegacyState = {
  settings: LegacySettings;
  /** Semaine courante du prototype (au minimum { start }). */
  week: Record<string, unknown>;
  bank?: Record<string, { boxes: number; added: number }>;
  pantry?: Record<string, number | null>;
  ratings?: Record<string, 1 | -1>;
  history?: string[][];
};

export type Legacy = {
  /** Évalue une expression après avoir fixé l'état et la graine ; renvoie sa valeur sérialisée. */
  run<T>(state: LegacyState, seed: number, expression: string): T;
};

let cached: Legacy | null = null;

export function loadLegacy(): Legacy {
  if (cached) return cached;
  const html = readFileSync(new URL("../../reference/menu-legacy.html", import.meta.url), "utf8");
  const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const storage: Record<string, string> = {};
  const ctx: Record<string, unknown> = {
    console,
    URLSearchParams,
    Math: Object.create(Math),
    Date,
    JSON,
    Intl,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    localStorage: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => (storage[k] = String(v)),
      removeItem: (k: string) => delete storage[k],
    },
    document: stub(),
    navigator: stub(),
    location: stub(),
    fetch: () => new Promise(() => {}),
    matchMedia: () => stub(),
    requestAnimationFrame: () => 0,
    addEventListener: () => {},
    alert: () => {},
    confirm: () => true,
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "menu-legacy.js" });

  cached = {
    run<T>(state: LegacyState, seed: number, expression: string): T {
      (ctx.Math as { random: () => number }).random = seededRandom(seed);
      ctx.__state = state;
      const json = vm.runInContext(
        `(() => {
          const s = __state;
          settings = Object.assign({ kid: 0.5, gateau: true }, s.settings);
          week = JSON.parse(JSON.stringify(s.week));
          bank = JSON.parse(JSON.stringify(s.bank || {}));
          pantry = JSON.parse(JSON.stringify(s.pantry || {}));
          ratings = JSON.parse(JSON.stringify(s.ratings || {}));
          history = JSON.parse(JSON.stringify(s.history || []));
          IGNORE_DISLIKE = false; NEED_CM = 0; PASTA_NEED = null;
          return JSON.stringify(${expression});
        })()`,
        ctx,
      ) as string;
      return JSON.parse(json) as T;
    },
  };
  return cached;
}
