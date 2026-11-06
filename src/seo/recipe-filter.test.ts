import { describe, expect, it } from "vitest";
import { filterQuery, NO_FILTER, pageCount, parseFilter } from "./recipe-filter";

describe("état de /recettes dans l'URL", () => {
  it("aller-retour de la recherche et de la page", () => {
    const f = { q: "plat italien réconfortant", page: 3 };
    expect(parseFilter(new URLSearchParams(filterQuery(f)))).toEqual(f);
    expect(filterQuery(NO_FILTER)).toBe("");
    expect(parseFilter(new URLSearchParams("page=-2")).page).toBe(1);
    expect(parseFilter(new URLSearchParams("page=abc")).page).toBe(1);
  });

  it("10 recettes par page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
  });
});
