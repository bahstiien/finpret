/** Contrôles de forme d'un numéro d'association (SPEC_JANVIER §3 C) : RNA (W + 9 chiffres) ou SIREN / SIRET (clé de Luhn). */
export type RnaCheck = { kind: "rna" | "siren" | "siret" | null; valid: boolean; message: string };

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

export function checkRnaOrSiren(raw: string): RnaCheck {
  const value = raw.replace(/\s+/g, "").toUpperCase();
  if (/^W\d{9}$/.test(value)) return { kind: "rna", valid: true, message: "Format RNA valide" };
  if (/^\d{9}$/.test(value)) {
    return luhn(value)
      ? { kind: "siren", valid: true, message: "SIREN valide (clé de contrôle correcte)" }
      : { kind: "siren", valid: false, message: "SIREN : la clé de contrôle est incorrecte" };
  }
  if (/^\d{14}$/.test(value)) {
    return luhn(value) || value.startsWith("356000000")
      ? { kind: "siret", valid: true, message: "SIRET valide" }
      : { kind: "siret", valid: false, message: "SIRET : la clé de contrôle est incorrecte" };
  }
  return {
    kind: null,
    valid: false,
    message: "Format non reconnu (RNA : W + 9 chiffres ; SIREN : 9 chiffres)",
  };
}

/** Domaines d'e-mail jetables ou génériques à regarder de plus près avant de valider une association. */
const SUSPECT_DOMAINS = [
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
];

export function checkAssociationEmail(email: string): { valid: boolean; message: string } {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { valid: false, message: "Adresse invalide" };
  if (SUSPECT_DOMAINS.includes(domain)) return { valid: false, message: "Adresse jetable" };
  return { valid: true, message: "Adresse plausible" };
}
