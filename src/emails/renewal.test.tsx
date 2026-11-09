import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RenewalNoticeEmail } from "@/emails/templates";

describe("e-mail de reconduction annuelle (L215-1)", () => {
  it("donne la date, le prix, la mention de TVA et le moyen de ne pas reconduire", async () => {
    const text = await render(
      createElement(RenewalNoticeEmail, {
        renewalDate: "4 janvier 2028",
        price: "49,99 €",
        url: "https://finpret.app/settings/subscription",
      }),
      { plainText: true },
    );
    expect(text).toContain("4 janvier 2028");
    expect(text).toContain("49,99 €");
    expect(text).toContain("TVA non applicable, art. 293 B du CGI");
    expect(text).toContain("résilier avant le 4 janvier 2028");
    expect(text).toContain("https://finpret.app/settings/subscription");
  });
});
