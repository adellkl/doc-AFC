# AFC — Registre des dossiers

Application React/Tailwind dédiée au dépôt de dossiers d’adhésion d’Alpha Fight Club.

- `/` : formulaire public unique, sans espace adhérent
- `/#/admin` : registre administrateur, recherche, statuts, consultation et téléchargement des documents
- Confirmation de dépôt avec paillettes/confettis
- Dépôt public via une Edge Function Supabase et pièces enregistrées dans un bucket privé

## Démarrer

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseignez dans `.env.local` l’URL du projet et sa clé **publishable**. Ces deux valeurs sont destinées au navigateur ; ne placez jamais de clé `service_role` ou de clé secrète dans un fichier `VITE_*`.

Le back-office utilise Supabase Auth avec e-mail/mot de passe : créez les comptes administrateurs dans Supabase, puis ajoutez leur identifiant dans `public.admin_users`. L’interface ne permet pas d’inscrire de nouveaux comptes.

## Important avant une mise en ligne

Déployez les Edge Functions `submit-application` et `admin-application-document` avant d’utiliser l’application. La première accepte le dépôt public `multipart/form-data`; la seconde doit vérifier la session administrateur et retourner une URL signée courte durée pour une pièce donnée.

Avant de collecter de vrais dossiers, vérifiez aussi :

- des contrôles de type/taille de fichier côté serveur et antivirus ;
- une politique RGPD de conservation/suppression, une notice d’information et HTTPS.
# doc-AFC
