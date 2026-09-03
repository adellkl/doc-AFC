# AFC — Registre des dossiers

Application React/Tailwind dédiée au dépôt de dossiers d’adhésion d’Alpha Fight Club.

- `/` : formulaire public unique, sans espace adhérent
- `/#/admin` : registre administrateur, recherche, statuts, consultation et téléchargement des documents
- Confirmation de dépôt avec paillettes/confettis
- Documents stockés en **IndexedDB**, uniquement dans le navigateur courant, pour la démonstration locale

## Démarrer

```bash
npm install
cp .env.example .env.local
npm run dev
```

Par défaut, le code de démonstration du back-office est `afc-demo`. Vous pouvez le remplacer dans `.env.local` avec `VITE_ADMIN_ACCESS_CODE`.

## Important avant une mise en ligne

Cette version est une démonstration fonctionnelle locale : IndexedDB et le code d’accès côté navigateur ne protègent pas des cartes d’identité ni des certificats médicaux en production.

Avant de collecter de vrais dossiers, raccorder :

- une authentification admin côté serveur avec rôles ;
- un stockage privé chiffré et des URLs signées à durée courte ;
- des contrôles de type/taille de fichier côté serveur et antivirus ;
- une politique RGPD de conservation/suppression, une notice d’information et HTTPS.
# doc-AFC
