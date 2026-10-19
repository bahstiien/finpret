// Lecture de la sortie TAP produite par pgTAP (une ligne par résultat de requête).

/** Affiche les lignes TAP et renvoie le nombre d'échecs. */
export function reportTap(results) {
  let failures = 0;
  for (const { rows } of [results].flat()) {
    for (const row of rows ?? []) {
      const line = Object.values(row)[0];
      if (typeof line !== "string" || !/^(not ok|ok|1\.\.|#)/.test(line.trim())) continue;
      console.log(line);
      if (line.startsWith("not ok") || line.includes("Looks like")) failures++;
    }
  }
  return failures;
}
