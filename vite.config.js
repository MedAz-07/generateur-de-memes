/**
 * Configuration de build et de serveur Vite.
 *
 * Rôle dans le projet : produire un site statique dans `dist/`, sans backend.
 *
 * `base: './'` rend les chemins des assets relatifs : le build fonctionne
 * aussi bien à la racine d'un domaine que dans un sous-dossier, ce qui laisse
 * le choix de l'hébergeur. `server.host` autorise l'accès au serveur de
 * développement depuis l'aperçu de l'éditeur et depuis un téléphone du même
 * réseau.
 *
 * Commandes : `npm run dev`, `npm run build`, `npm run preview`.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0' },
});
