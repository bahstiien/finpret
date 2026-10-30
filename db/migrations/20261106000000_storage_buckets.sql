-- Buckets Storage privés du module associations. Ils étaient créés à la volée (kit) ou jamais (relevés). Le PDF de cantine n'est pas conservé : pas de bucket.
-- Aucune politique n'est ajoutée : seul le serveur, avec la clé de service, lit et écrit (RLS de storage.objects
-- refuse tout le reste). Garde `to_regclass` : le schéma storage n'existe pas dans les tests PGlite.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values
      ('asso-kits', 'asso-kits', false),
      ('asso-statements', 'asso-statements', false)
    on conflict (id) do update set public = false;
  end if;
end
$$;
