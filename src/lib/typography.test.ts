import { describe, expect, it } from "vitest";
import { nb } from "./typography";

describe("nb", () => {
  it("insère une espace insécable avant la ponctuation haute", () => {
    expect(nb("Ce soir : bolognaise ! Prêt ?")).toBe("Ce soir : bolognaise ! Prêt ?");
  });

  it("colle les guillemets français au texte", () => {
    expect(nb("« À table »")).toBe("« À table »");
  });

  it("lie les nombres à leur unité", () => {
    expect(nb("200 g de pâtes, 25 min à 200 °C, 10 repas")).toBe("200 g de pâtes, 25 min à 200 °C, 10 repas");
  });

  it("lie les heures et les minutes", () => {
    expect(nb("2 h 30 le dimanche, 17 h 30")).toBe("2 h 30 le dimanche, 17 h 30");
  });

  it("laisse intact un nombre suivi d'un mot ordinaire", () => {
    expect(nb("3 gousses d’ail")).toBe("3 gousses d’ail");
  });
});
