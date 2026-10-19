import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { fr } from "@/i18n/fr";

const featureTones = ["bg-violet text-white", "bg-pink-soft text-pink-ink", "bg-blue-soft text-blue-ink"];

export default function HomePage() {
  const t = fr.home;
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-2xl bg-violet font-display text-2xl font-black text-white"
        >
          M
        </span>
        <span className="font-display text-xl font-extrabold">{fr.app.name}</span>
      </header>

      <section className="flex flex-col gap-6 rounded-card bg-surface p-6 sm:p-10">
        <Pill tone="yellow" className="self-start">
          {t.eyebrow}
        </Pill>
        <h1 className="max-w-3xl text-4xl leading-tight font-black sm:text-5xl">{t.title}</h1>
        <p className="max-w-2xl text-lg text-muted">{t.lead}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled aria-describedby="login-soon">
            {t.login}
          </Button>
          <span id="login-soon" className="text-sm text-muted">
            {t.loginSoon}
          </span>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {t.features.map((f, i) => (
          <li key={f.title} className={`flex flex-col gap-2 rounded-card p-6 ${featureTones[i]}`}>
            <h2 className="text-xl font-extrabold">{f.title}</h2>
            <p>{f.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
