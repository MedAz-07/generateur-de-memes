/**
 * Miniature d'un mème enregistré.
 *
 * Rôle dans le projet : afficher un aperçu dans les cartes de la galerie et
 * dans la modale grand format. Le DataURL du fond est rechargé en Image puis
 * redessiné avec drawMeme() : aucune miniature n'est stockée dans le
 * LocalStorage, ce qui économise le quota et garantit un rendu cohérent avec
 * l'éditeur et l'export.
 *
 * Utilisé par : Gallery.jsx.
 */

import React, { useEffect, useRef } from 'react';
import { drawMeme } from '../lib/drawMeme.js';
import { loadImage } from '../lib/image.js';

/**
 * Dessine un mème de galerie sur un canvas à l'échelle demandée.
 *
 * Props:
 *   meme (object): Entrée de galerie (background en DataURL, dimensions, textes).
 *   scale (number, optional): Facteur d'échelle, 0.4 par défaut pour une carte.
 *   className (string, optional): Classe CSS ajoutée au canvas (modale, carte).
 *
 * Returns:
 *   JSX.Element: Élément `<canvas>` avec un rôle d'image et un aria-label.
 *
 * Notes:
 *   Le chargement de l'image est asynchrone : le drapeau `cancelled` évite
 *   d'écrire sur un canvas démonté si la galerie change entre-temps.
 */
export default function MemeThumbnail({ meme, scale = 0.4, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    loadImage(meme.background)
      .then((image) => {
        if (cancelled || !canvasRef.current) return;
        canvas.width = Math.max(1, Math.round(meme.width * scale));
        canvas.height = Math.max(1, Math.round(meme.height * scale));
        drawMeme(canvas.getContext('2d'), { ...meme, background: image }, scale);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [meme, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`Aperçu du mème ${meme.title}`}
    />
  );
}
