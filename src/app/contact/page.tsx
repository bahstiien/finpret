import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ContactForm } from "@/components/contact/ContactForm";
import { Card } from "@/components/ui/Card";
import { Faq } from "@/components/ui/Extras";
import { Icon } from "@/components/ui/Icon";
import { PageHeader, SectionHeader } from "@/components/ui/Layout";
import { fr } from "@/i18n/fr";

const t = fr.contact;

export const metadata: Metadata = {
  title: t.title,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <AuthShell aside={t.haveAccount} asideHref="/login" asideLabel={t.login}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <PageHeader eyebrow={t.kicker} title={t.heading} />
          <p className="t-body max-w-2xl text-lg">{t.lead}</p>
        </div>

        <div className="flex flex-col items-start gap-10 min-[1000px]:flex-row min-[1000px]:gap-12">
          <section
            aria-label={t.title}
            className="w-full min-w-0 min-[1000px]:max-w-[720px] min-[1000px]:flex-[1_1_560px]"
          >
            <ContactForm />
          </section>

          <aside className="flex w-full min-w-0 flex-col gap-5 min-[1000px]:max-w-[420px] min-[1000px]:flex-[1_1_320px]">
            <SectionHeader title={t.faqTitle} />
            {t.faq.map((item, i) => (
              <Faq key={item.q} question={item.q} defaultOpen={i === 0}>
                {item.a}
              </Faq>
            ))}
            <Card tone="yellow" padding="sm" className="!shadow-none">
              <div className="flex items-center gap-3">
                <Icon name="clock" />
                <p className="t-small">{t.delay}</p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AuthShell>
  );
}
