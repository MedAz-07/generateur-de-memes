/**
 * Persistance de la galerie dans le LocalStorage.
 *
 * Rôle dans le projet : c'est le seul endroit du code qui lit ou écrit
 * `window.localStorage`. Une migration vers IndexedDB se limiterait donc à
 * réécrire ce fichier, sans toucher aux composants.
 *
 * Clé utilisée : `meme-gallery:v1`, de forme
 * `{ version: 1, memes: [ { id, createdAt, title, width, height, background, texts } ] }`.
 * On stocke le fond compressé SANS texte, plus les calques de texte : avec un
 * mème déjà aplati, la ré-édition afficherait le texte une seconde fois.
 *
 * Limite à garder en tête : environ 5 Mo par origine (domaine + port). Les
 * données créées sur localhost n'apparaissent donc pas sur le site déployé.
 *
 * Utilisé par : App.jsx, Gallery.jsx.
 */

import { formatBytes } from './image.js';

export const STORAGE_KEY = 'meme-gallery:v1';
export const SCHEMA_VERSION = 1;
export const QUOTA_BYTES = 5 * 1024 * 1024;
export const QUOTA_WARN_RATIO = 0.8;

/**
 * Construit une galerie vide conforme au schéma courant.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   {version: number, memes: object[]}: Galerie vide, version 1.
 */
export function emptyGallery() {
  return { version: SCHEMA_VERSION, memes: [] };
}

/**
 * Recharge la galerie au démarrage de l'application.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   {version: number, memes: object[]}: Galerie enregistrée, ou une galerie
 *     vide si la clé est absente, illisible ou d'une version incompatible.
 *
 * Notes:
 *   Les erreurs de lecture sont journalisées dans la console mais jamais
 *   remontées à l'utilisateur : l'application doit rester utilisable même si
 *   le stockage est désactivé (navigation privée, cookies bloqués).
 */
export function loadGallery() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyGallery();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.memes)) {
      console.warn('[gallery] schéma incompatible, galerie réinitialisée');
      return emptyGallery();
    }
    return parsed;
  } catch (error) {
    console.warn('[gallery] lecture impossible', error);
    return emptyGallery();
  }
}

/**
 * Estime la taille réelle de ce qui sera écrit dans le LocalStorage.
 *
 * Args:
 *   gallery (object): Galerie complète à sérialiser.
 *
 * Returns:
 *   number: Taille approximative en octets.
 *
 * Notes:
 *   Les DataURL sont de l'ASCII, donc la longueur de la chaîne est proche du
 *   nombre d'octets. `Blob` donne une mesure plus juste quand il est disponible.
 */
export function estimateBytes(gallery) {
  const json = JSON.stringify(gallery);
  try {
    return new Blob([json]).size;
  } catch {
    return json.length;
  }
}

/**
 * Calcule la part du quota déjà utilisée.
 *
 * Args:
 *   gallery (object): Galerie à mesurer.
 *
 * Returns:
 *   number: Rapport entre 0 et 1, borné à 1.
 */
export function usageRatio(gallery) {
  return Math.min(1, estimateBytes(gallery) / QUOTA_BYTES);
}

/**
 * Formate le texte affiché au-dessus de la barre de quota.
 *
 * Args:
 *   gallery (object): Galerie à mesurer.
 *
 * Returns:
 *   string: Libellé du type '27.4 Ko / ~5.00 Mo'.
 */
export function usageLabel(gallery) {
  const bytes = estimateBytes(gallery);
  return `${formatBytes(bytes)} / ~${formatBytes(QUOTA_BYTES)}`;
}

/**
 * Écrit la galerie et contrôle le quota disponible.
 *
 * Args:
 *   gallery (object): Galerie complète à enregistrer (remplace la précédente).
 *
 * Returns:
 *   number: Nombre d'octets écrits.
 *
 * Raises:
 *   Error: Si la taille estimée atteint le quota, si le navigateur lève
 *     `QuotaExceededError`, ou s'il refuse le stockage. Les messages proposent
 *     une action concrète (supprimer un mème, exporter en JSON) au lieu d'une
 *     erreur technique.
 *
 * Notes:
 *   App.jsx intercepte ces erreurs et les affiche dans une notification.
 */
export function saveGallery(gallery) {
  const bytes = estimateBytes(gallery);
  if (bytes >= QUOTA_BYTES) {
    throw new Error(
      `Espace de stockage saturé (${formatBytes(bytes)} / ~5 Mo). Supprimez un ancien mème ou exportez votre galerie au format JSON, puis réessayez.`,
    );
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
  } catch (error) {
    const quota = error && (error.name === 'QuotaExceededError' || error.code === 22);
    if (quota) {
      throw new Error(
        'Espace de stockage saturé (~5 Mo). Supprimez un ancien mème ou exportez votre galerie au format JSON, puis réessayez.',
      );
    }
    throw new Error(
      "Impossible d'enregistrer : le navigateur refuse le stockage local (navigation privée ou cookies bloqués ?).",
    );
  }
  return bytes;
}

/**
 * Télécharge la galerie sous forme de fichier JSON.
 *
 * Args:
 *   gallery (object): Galerie à sauvegarder.
 *
 * Returns:
 *   void: Déclenche un téléchargement nommé `galerie-memes-AAAA-MM-JJ.json`.
 *
 * Notes:
 *   C'est la parade à la perte de données quand l'utilisateur vide le cache
 *   du navigateur : le fichier peut être réimporté ensuite.
 */
export function downloadGalleryJson(gallery) {
  const blob = new Blob([JSON.stringify(gallery, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `galerie-memes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Valide et normalise le contenu d'un fichier JSON importé.
 *
 * Args:
 *   text (string): Contenu brut du fichier choisi par l'utilisateur.
 *
 * Returns:
 *   {version: number, memes: object[]}: Galerie de version 1, débarrassée des
 *     entrées manifestement invalides.
 *
 * Raises:
 *   Error: Si le texte n'est pas du JSON valide ou si la structure ne
 *     correspond pas à une galerie de version 1.
 *
 * Notes:
 *   Une entrée incomplète est ignorée avec un avertissement en console plutôt
 *   que de faire échouer tout l'import.
 */
export function parseGalleryJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide.');
  }
  if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.memes)) {
    throw new Error('Ce fichier ne contient pas une galerie compatible (version 1).');
  }
  const memes = parsed.memes.filter(
    (m) => m && typeof m.background === 'string' && Array.isArray(m.texts) && m.width && m.height,
  );
  if (memes.length !== parsed.memes.length) {
    console.warn('[gallery] mèmes invalides ignorés lors de l’import');
  }
  return { version: SCHEMA_VERSION, memes };
}
