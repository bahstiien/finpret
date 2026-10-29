import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Avatar,
  Badge,
  Bento,
  Breadcrumbs,
  Button,
  Callout,
  Card,
  Checkbox,
  Coachmark,
  Difficulty,
  Dot,
  EmptyState,
  Faq,
  Icon,
  type IconName,
  LinkButton,
  IconButton,
  ListRow,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Skeleton,
  StatTile,
  Sticker,
  TextField,
  TextLink,
} from "@/components/ui";
import type { ButtonVariant } from "@/components/ui";
import { InteractiveDemo } from "@/components/ui/Gallery";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const COLORS = [
  "bg",
  "surface",
  "ink",
  "muted",
  "line",
  "violet",
  "banana",
  "green",
  "blue-soft",
  "pink-soft",
  "yellow-soft",
  "peach",
  "chip",
  "violet-soft",
  "green-soft",
  "nav",
];
const VARIANTS: ButtonVariant[] = ["primary", "secondary", "outline", "dark", "ghost", "danger"];
const TONES = ["chip", "violet", "yellow", "blue", "pink", "peach", "green", "dark"] as const;
const CARDS = ["surface", "violet", "dark", "yellow", "blue", "pink", "peach", "green"] as const;
const ICONS: IconName[] = [
  "menu",
  "compass",
  "basket",
  "fridge",
  "timer",
  "print",
  "clock",
  "pot",
  "user",
  "plus",
  "check",
  "search",
  "info",
  "warning",
  "chevronRight",
  "sparkle",
];

/** Seules valeurs d'espacement autorisées (design-system/tokens.json). */
const SPACING = [0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96];

/** Rayons de l'échelle Tailwind ; `card` et `sheet` en sont des alias (24 et 32 px). */
const RADII: [string, string][] = [
  ["lg 8", "rounded-card"],
  ["xl 12", "rounded-card"],
  ["2xl 16", "rounded-card"],
  ["card 24", "rounded-card"],
  ["sheet 32", "rounded-sheet"],
  ["pill", "rounded-r2"],
];

/** Galerie vivante du design system (docs/DESIGN_SYSTEM.md). Réservée au développement. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <PageHeader
        eyebrow="Fin Prêt"
        title="Design system"
        description="Les briques réutilisées sur toutes les interfaces. Bascule le thème du système pour voir le mode sombre."
      />

      <Group title="Couleurs">
        <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c} className="flex flex-col gap-1">
              <span className="h-14 rounded-card border border-line" style={{ background: `var(--${c})` }} />
              <code className="text-xs text-muted">--{c}</code>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Typographie">
        <div className="flex flex-col gap-2">
          <p className="text-4xl font-bold">Titre de page · Archivo Black 36</p>
          <p className="text-2xl font-bold">Titre de section · 24</p>
          <p className="text-lg font-semibold">Titre de carte · 18</p>
          <p>Texte courant · 16, interligne confortable pour lire sans effort.</p>
          <p className="text-sm text-muted">Texte secondaire · 14, couleur discrète</p>
          <p className="text-xs text-muted">Une seule famille, graisses 400 à 700, jamais d&apos;italique. Tailles : échelle Tailwind.</p>
        </div>
      </Group>

      <Group title="Espacements">
        <ul className="flex flex-col gap-1">
          {SPACING.map((px) => (
            <li key={px} className="flex items-center gap-3 text-xs text-muted">
              <span className="w-12 font-mono">{px} px</span>
              <span className="h-2 rounded-sm bg-violet" style={{ width: Math.max(px, 2) }} />
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Rayons">
        <div className="flex flex-wrap items-end gap-4">
          {RADII.map(([name, cls]) => (
            <div key={name} className="flex flex-col items-center gap-1 text-xs text-muted">
              <span className={`size-24 bg-violet ${cls}`} />
              <code>{name}</code>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Rayon intérieur = rayon extérieur − marge, quand la marge fait moins de 32 px et que le résultat dépasse 2 px.
        </p>
      </Group>

      <Group title="Mouvement">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex min-h-11 items-center rounded-card bg-violet-soft px-3 py-2 text-base font-semibold text-violet-strong transition duration-300 ease-base hover:bg-violet hover:text-white border-[length:var(--bw)] border-line">
            Survol 300 ms
          </span>
          <span className="text-sm text-muted">
            Courbe <code>ease-base</code> = cubic-bezier(0.22, 1, 0.36, 1) ; 500 ms pour les déplacements, 700 ms pour
            les apparitions ; on n&apos;anime que transform et opacity.
          </span>
        </div>
      </Group>

      <Group title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          {VARIANTS.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
          <Button size="sm">petit</Button>
          <Button size="lg">grand</Button>
          <Button disabled>désactivé</Button>
          <LinkButton href="#" variant="dark">
            Lien-bouton
          </LinkButton>
          <IconButton icon="plus" label="Ajouter" tone="chip" />
        </div>
      </Group>

      <Group title="Pastilles">
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
        </div>
      </Group>

      <Group title="Cartes">
        <div className="grid gap-4 min-[600px]:grid-cols-2">
          {CARDS.map((t) => (
            <Card key={t} tone={t}>
              <h3 className="text-lg font-bold">Carte {t}</h3>
              <p className="opacity-80">Rayon 2 px, bordure encre, ombre dure.</p>
            </Card>
          ))}
        </div>
      </Group>

      <Group title="Néo-brutalisme">
        <div className="flex flex-wrap items-center gap-4">
          <Sticker tone="banane">Nouveau</Sticker>
          <Sticker>Passeport · Italie</Sticker>
          <Sticker tone="pink">−30 %</Sticker>
          {[1, 2, 3, 4].map((l) => (
            <Difficulty key={l} level={l as 1 | 2 | 3 | 4} />
          ))}
          <Dot label="12 articles restants" />
          <p className="t-body">
            Ta liste suit ton menu. <TextLink href="#">Voir le menu</TextLink>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Checkbox label="Poireaux" defaultChecked />
          <Checkbox label="Lentilles corail" />
          <Checkbox label="Grande case" large defaultChecked />
          <Checkbox label="Indisponible" disabled />
        </div>
        <Bento columns={3} shadow="md">
          <div className="flex flex-col gap-1 p-3">
            <span className="t-kicker">Besoin</span>
            <span className="num-l">600 g</span>
          </div>
          <div className="flex flex-col gap-1 p-3">
            <span className="t-kicker">Acheté</span>
            <span className="num-l">500 g</span>
          </div>
          <div className="tone-warning flex flex-col gap-1 p-3">
            <span className="t-kicker">Reste</span>
            <span className="num-l">100 g</span>
          </div>
        </Bento>
        <Breadcrumbs items={[{ label: "Recettes", href: "/recettes" }, { label: "Inde" }, { label: "Dhal de lentilles corail" }]} />
        <div className="grid gap-4 min-[600px]:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Faq question="Combien coûte Fin Prêt ?" defaultOpen>
              5,99 € par mois, ou 49,99 € par an (soit 4,17 € par mois).
            </Faq>
            <Faq question="Je peux arrêter quand je veux ?">Oui, en deux clics depuis Réglages.</Faq>
          </div>
          <Coachmark step="Astuce 2 / 6" title="Ta liste se remplit toute seule" secondaryLabel="Plus tard">
            Elle suit ton menu. Coche au fil des rayons.
          </Coachmark>
        </div>
      </Group>

      <Group title="Données">
        <div className="grid gap-4 min-[600px]:grid-cols-3">
          <StatTile label="Session" value="2 h 08" hint="18 étapes" tone="blue" />
          <StatTile label="Courses" value="19" hint="articles restants" tone="yellow" />
          <StatTile label="Série" value="6 sem." tone="green" />
        </div>
        <div className="flex items-center gap-6">
          <ProgressRing value={45} label="Avancement" />
          <div className="flex-1">
            <ProgressBar value={72} label="Courses cochées" />
          </div>
          <Avatar name="Camille" />
        </div>
        <div className="flex flex-col gap-2">
          <ListRow
            icon="basket"
            title="Courses de la semaine"
            subtitle="19 articles"
            trailing={<Icon name="chevronRight" />}
          />
          <ListRow
            icon="fridge"
            tone="blue"
            title="Stock"
            subtitle="Congélateur · 4 plats"
            trailing={<Badge tone="green">À jour</Badge>}
          />
        </div>
      </Group>

      <Group title="Messages">
        <div className="flex flex-col gap-3">
          <Callout tone="info">Information neutre.</Callout>
          <Callout tone="success">C&apos;est enregistré.</Callout>
          <Callout tone="warning">Attention, il manque un ingrédient.</Callout>
          <Callout tone="error">Quelque chose s&apos;est mal passé.</Callout>
        </div>
        <EmptyState
          icon="basket"
          title="Rien à acheter"
          action={<LinkButton href="#">Préparer la semaine</LinkButton>}
        >
          Ta liste de courses apparaît dès que le menu est prêt.
        </EmptyState>
      </Group>

      <Group title="Formulaires">
        <div className="grid gap-4 min-[600px]:grid-cols-2">
          <TextField id="demo" label="Prénom" placeholder="Camille" />
          <InteractiveDemo />
        </div>
      </Group>

      <Group title="Icônes">
        <ul className="flex flex-wrap gap-3">
          {ICONS.map((i) => (
            <li key={i} title={i} className="grid size-12 place-items-center rounded-card bg-surface border-[length:var(--bw)] border-line">
              <Icon name={i} />
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Chargement">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}
