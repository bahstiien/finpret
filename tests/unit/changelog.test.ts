import { describe, expect, it } from "vitest";
import { buildChangelog, parseLog } from "../../scripts/lib/changelog.mjs";

describe("changelog des déploiements", () => {
  it("prend le titre des PR fusionnées et ignore les fusions de branche", () => {
    const out =
      "Merge pull request #63 from x/fix\x1fMobile : boutons\n\ndétail\x1e\n" +
      "Corrige une coquille\x1f\x1e\n" +
      "Merge branch 'main' into x\x1f\x1e\n";
    expect(parseLog(out)).toEqual([
      { pr: 63, title: "Mobile : boutons" },
      { pr: null, title: "Corrige une coquille" },
    ]);
  });

  it("rattache à chaque déploiement ce qui a changé depuis le précédent, du plus récent au plus ancien", () => {
    const deploys = [
      { sha: "a", at: "1", run: 1 },
      { sha: "b", at: "2", run: 2 },
    ];
    const log = buildChangelog(deploys, (from, to) => [{ pr: 1, title: `${from}..${to}` }]);
    expect(log.map((d) => [d.sha, d.changes])).toEqual([
      ["b", [{ pr: 1, title: "a..b" }]],
      ["a", []],
    ]);
  });
});
