/**
 * Export du mème et partage.
 *
 * Rôle dans le projet : produire le fichier image final et proposer les trois
 * voies de partage possibles sans serveur. Une application 100 % Frontend ne
 * peut pas publier une image sur le compte d'un utilisateur (il faudrait OAuth
 * et une API) : on essaie donc, dans l'ordre, le menu natif du système, la
 * copie dans le presse-papiers, puis les liens de partage de l'adresse du site.
 *
 * Prérequis : les API Web Share et Clipboard exigent une page servie en HTTPS.
 *
 * Utilisé par : App.jsx, ShareDialog.jsx.
 */

import { drawMeme } from './drawMeme.js';

/**
 * Dessine un mème sur un canvas détaché du DOM.
 *
 * Args:
 *   meme (object): Mème à rendre (background, dimensions, calques de texte).
 *   scale (number, optional): Facteur d'échelle, 1 par défaut (pleine
 *     résolution).
 *
 * Returns:
 *   HTMLCanvasElement: Canvas prêt à être converti en Blob ou en DataURL.
 *
 * Notes:
 *   Le canvas n'est pas inséré dans la page : il sert uniquement à l'export.
 */
export function renderMemeToCanvas(meme, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(meme.width * scale));
  canvas.height = Math.max(1, Math.round(meme.height * scale));
  drawMeme(canvas.getContext('2d'), meme, scale);
  return canvas;
}

/**
 * Convertit un canvas en Blob, de façon asynchrone.
 *
 * Args:
 *   canvas (HTMLCanvasElement): Canvas déjà dessiné.
 *   type (string, optional): MIME de sortie, 'image/png' par défaut.
 *   quality (number, optional): Qualité 0→1 pour JPEG/WebP, 0.92 par défaut.
 *
 * Returns:
 *   Promise<Blob>: Image binaire prête à être téléchargée ou partagée.
 *
 * Raises:
 *   Error: Si le navigateur ne parvient pas à encoder le canvas.
 */
export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de générer l'image."))),
      type,
      quality,
    );
  });
}

/**
 * Déclenche le téléchargement d'un Blob dans le navigateur.
 *
 * Args:
 *   blob (Blob): Données à télécharger.
 *   filename (string): Nom proposé à l'utilisateur.
 *
 * Returns:
 *   void.
 *
 * Notes:
 *   L'URL d'objet est révoquée après une seconde pour ne pas laisser de
 *   référence mémoire inutile.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Construit un nom de fichier horodaté.
 *
 * Args:
 *   extension (string, optional): Extension sans point, 'png' par défaut.
 *
 * Returns:
 *   string: Nom du type `meme-2026-11-13-18-10.png`.
 *
 * Notes:
 *   L'horodatage vient de `toISOString()` (UTC), ce qui évite les caractères
 *   interdits dans un nom de fichier.
 */
export function memeFilename(extension = 'png') {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `meme-${stamp}.${extension}`;
}

/**
 * Exporte le mème courant au format choisi.
 *
 * Args:
 *   meme (object): Mème à exporter, avec un `background` déjà décodé.
 *   format (string, optional): 'png' ou 'jpg', 'png' par défaut.
 *
 * Returns:
 *   Promise<void>: Résolue une fois le téléchargement déclenché.
 *
 * Raises:
 *   Error: Si l'encodage du canvas échoue. App.jsx affiche alors le message.
 *
 * Notes:
 *   Pour le JPEG, un fond opaque est ajouté sous le dessin
 *   (`destination-over`) car ce format ne gère pas la transparence.
 */
export async function downloadMeme(meme, format = 'png') {
  const isJpeg = format === 'jpg';
  const type = isJpeg ? 'image/jpeg' : 'image/png';
  const canvas = renderMemeToCanvas(meme, 1);
  if (isJpeg) {
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#84929f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  const blob = await canvasToBlob(canvas, type, 0.92);
  downloadBlob(blob, memeFilename(isJpeg ? 'jpg' : 'png'));
}

/**
 * Tente de partager l'image, puis retombe sur les mécanismes disponibles.
 *
 * Ordre des tentatives :
 *   1. `navigator.share({ files })` si le navigateur accepte les fichiers ;
 *   2. `navigator.clipboard.write()` avec un `ClipboardItem` image ;
 *   3. sinon, signal à l'application d'ouvrir la modale de repli.
 *
 * Args:
 *   meme (object): Mème à partager.
 *
 * Returns:
 *   Promise<string>: Un des états suivants :
 *     'shared' : partage natif réussi ;
 *     'copied' : image copiée dans le presse-papiers ;
 *     'cancelled' : l'utilisateur a fermé le sélecteur natif ;
 *     'unsupported' : aucun mécanisme disponible, repli à afficher.
 *
 * Notes:
 *   Une annulation par l'utilisateur n'est pas une erreur : elle retourne
 *   'cancelled' pour qu'App.jsx n'affiche aucune notification.
 */
export async function shareMeme(meme) {
  const canvas = renderMemeToCanvas(meme, 1);
  let blob;
  try {
    blob = await canvasToBlob(canvas, 'image/png');
  } catch {
    return 'unsupported';
  }

  const file = new File([blob], memeFilename('png'), { type: 'image/png' });
  if (navigator.share && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mon mème',
          text: 'Créé avec le Générateur de mèmes',
        });
        return 'shared';
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
    }
  }

  if (
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof window.ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({ 'image/png': blob }),
      ]);
      return 'copied';
    } catch {
      /* le repli est géré par ShareDialog */
    }
  }

  return 'unsupported';
}

/**
 * Construit les liens de partage universels.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   {label: string, href: string}[]: Liens X/Twitter, Facebook et WhatsApp.
 *
 * Notes:
 *   Ces liens partagent l'adresse du site, PAS l'image : sans backend il est
 *   impossible d'héberger le fichier à partager. Le bouton de téléchargement
 *   de la modale reste la solution pour publier l'image elle-même.
 */
export function socialLinks() {
  const url = window.location.href.split('#')[0];
  const text = 'Un mème créé avec le Générateur de mèmes.';
  return [
    {
      label: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
  ];
}

/**
 * Copie l'adresse du site dans le presse-papiers.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   Promise<boolean>: true si la copie a réussi, false si le navigateur l'a
 *     refusée (permission, contexte non sécurisé).
 */
export async function copySiteLink() {
  const url = window.location.href.split('#')[0];
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
