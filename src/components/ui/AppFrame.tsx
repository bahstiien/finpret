import { AppNav } from "./AppNav";

/**
 * Cadre commun des pages connectées (/app et /settings) : barre latérale sombre fixe à partir de 900 px,
 * barre flottante en bas sur mobile, contenu qui apparaît en douceur à chaque navigation.
 */
export function AppFrame({
  shoppingLeft,
  top,
  children,
  overlay,
}: {
  shoppingLeft: number;
  /** Éléments persistants au-dessus du contenu (minuteurs). */
  top?: React.ReactNode;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 gap-5 px-4 pt-6 pb-32 min-[900px]:max-w-[1400px] min-[900px]:grid-cols-[17rem_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:p-4 print:block print:max-w-none print:p-0">
        <div className="contents print:hidden">
          <AppNav shoppingLeft={shoppingLeft} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 min-[900px]:px-2 min-[900px]:py-4 min-[900px]:pr-4">
          {top && <div className="print:hidden">{top}</div>}
          <main className="page-enter flex flex-col gap-5">{children}</main>
        </div>
        {overlay}
      </div>
    </div>
  );
}
