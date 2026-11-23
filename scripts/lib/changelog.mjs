/** Séparateurs de `git log --format=%s%x1f%b%x1e` : champ (US) et commit (RS). */
export const LOG_FORMAT = "%s%x1f%b%x1e";

/** Commits du premier parent → motifs : une PR fusionnée donne son numéro et son titre (1re ligne du corps). */
export function parseLog(out) {
  return out
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [subject, body = ""] = c.split("\x1f");
      const pr = /^Merge pull request #(\d+)/.exec(subject);
      const title = pr ? body.trim().split("\n")[0] || subject : subject;
      return { pr: pr ? Number(pr[1]) : null, title };
    })
    .filter((c) => !/^Merge (branch|remote-tracking|origin\/)/.test(c.title));
}

/** Déploiements (du plus ancien au plus récent) → entrées du plus récent au plus ancien, avec ce que chacun a livré. */
export function buildChangelog(deploys, logBetween) {
  return deploys
    .map((d, i) => ({ ...d, changes: i === 0 ? [] : logBetween(deploys[i - 1].sha, d.sha) }))
    .reverse();
}
