import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
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
  TextField,
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
            <li key={c} className="flex flex-col gap-1.5">
              <span className="h-14 rounded-2xl border border-line" style={{ background: `var(--${c})` }} />
              <code className="text-xs text-muted">--{c}</code>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Typographie">
        <div className="flex flex-col gap-2">
          <p className="font-display text-4xl font-black">Titre de page · Gabarito 36</p>
          <p className="font-display text-2xl font-black">Titre de section · 24</p>
          <p className="text-lg font-extrabold">Titre de carte · Figtree 18</p>
          <p>Texte courant · Figtree 16, interligne confortable pour lire sans effort.</p>
          <p className="text-sm text-muted">Texte secondaire · 14, couleur discrète</p>
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
              <h3 className="text-lg font-extrabold">Carte {t}</h3>
              <p className="opacity-80">Rayon 28 px, marge intérieure de 24 px.</p>
            </Card>
          ))}
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
            <li key={i} title={i} className="grid size-12 place-items-center rounded-2xl bg-surface">
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
