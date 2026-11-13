/**
 * Aperçu temps réel et déplacement des blocs de texte (exigences FR-02/FR-03).
 *
 * Rôle dans le projet : dessiner le mème courant sur un canvas et permettre de
 * faire glisser chaque bloc de texte. Le dessin est confié à drawMeme(), la
 * détection du clic à layoutText(). Toute modification de l'état `meme` par
 * App.jsx redéclenche l'effet de dessin : il n'y a aucun bouton « Appliquer ».
 *
 * Point clé : les coordonnées du pointeur sont converties en fractions de la
 * taille affichée (0→1), exactement comme les positions x/y stockées dans le
 * mème. Le déplacement reste donc correct quelle que soit la taille du canvas.
 *
 * Utilisé par : App.jsx.
 */

import React, { useEffect, useRef } from 'react';
import { drawMeme, layoutText, clamp } from '../lib/drawMeme.js';
import { loadImage } from '../lib/image.js';

/**
 * Affiche l'aperçu du mème et gère le glisser-déposer des textes.
 *
 * Props:
 *   meme (object|null): Mème courant { background, width, height, texts }.
 *     `background` est un HTMLImageElement dans l'éditeur ; un DataURL est
 *     également accepté (cas d'une réouverture depuis la galerie).
 *   selectedId (string|null): Bloc sélectionné, entouré d'un cadre pointillé.
 *   onSelect (function): (string|null) => met à jour la sélection.
 *   onMove (function): (string, number, number) => déplace un bloc ; x et y
 *     sont des fractions comprises entre 0 et 1.
 *
 * Returns:
 *   JSX.Element: Cadre d'aperçu, ou un état vide si aucune image n'est chargée.
 *
 * Notes:
 *   `touch-action: none` est posé en CSS pour que le glisser fonctionne aussi
 *   au doigt sur mobile, sans déclencher le défilement de la page.
 */
export default function MemeCanvas({ meme, selectedId, onSelect, onMove }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  // Redessine à chaque changement de mème ou de sélection. Le fond peut être
  // un DataURL : dans ce cas on attend son décodage avant de peindre.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meme || !meme.background) return undefined;

    let frame = 0;
    let background = meme.background;
    let cancelled = false;

    if (typeof background === 'string') {
      canvas.width = Math.round(meme.width * 0.4);
      canvas.height = Math.round(meme.height * 0.4);
      loadImage(background)
        .then((img) => {
          if (cancelled) return;
          background = img;
          paint(canvas, { ...meme, background: img });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    frame = requestAnimationFrame(() => paint(canvas, { ...meme, background }));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };

    /**
     * Peint le mème puis le cadre de sélection éventuel.
     *
     * Args:
     *   target (HTMLCanvasElement): Canvas à redimensionner et à dessiner.
     *   source (object): Mème dont le `background` est une image décodée.
     */
    function paint(target, source) {
      target.width = Math.max(1, Math.round(source.width));
      target.height = Math.max(1, Math.round(source.height));
      const ctx = target.getContext('2d');
      drawMeme(ctx, source, 1);

      const selected = source.texts.find((text) => text.id === selectedId);
      if (selected) {
        const layout = layoutText(ctx, selected, source.width, source.height);
        ctx.save();
        ctx.setLineDash([Math.max(6, layout.px * 0.18), Math.max(5, layout.px * 0.14)]);
        ctx.lineWidth = Math.max(2, source.width * 0.0025);
        ctx.strokeStyle = '#243b53';
        ctx.strokeRect(
          layout.box.left,
          layout.box.top,
          layout.box.right - layout.box.left,
          layout.box.bottom - layout.box.top,
        );
        ctx.restore();
      }
    }
  }, [meme, selectedId]);

  /**
   * Convertit la position du pointeur en fractions de la taille affichée.
   *
   * Args:
   *   event (PointerEvent): Événement souris ou tactile du canvas.
   *
   * Returns:
   *   {x: number, y: number}: Coordonnées relatives, entre 0 et 1.
   *
   * Notes:
   *   On utilise `getBoundingClientRect()` (taille CSS) et non `canvas.width`
   *   (taille interne) : le canvas est souvent réduit par la mise en page.
   */
  function pointerFraction(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  /**
   * Sélectionne le bloc situé sous le pointeur et démarre le glisser.
   *
   * Args:
   *   event (PointerEvent): Appui sur le canvas.
   *
   * Notes:
   *   Les blocs sont testés du dernier vers le premier, donc celui dessiné
   *   au-dessus est prioritaire. L'écart entre le point d'appui et le centre
   *   du bloc est mémorisé pour éviter un saut au premier mouvement.
   */
  function handlePointerDown(event) {
    if (!meme || typeof meme.background === 'string') return;
    const point = pointerFraction(event);
    const ctx = canvasRef.current.getContext('2d');

    for (let index = meme.texts.length - 1; index >= 0; index -= 1) {
      const text = meme.texts[index];
      const layout = layoutText(ctx, text, meme.width, meme.height);
      const box = layout.box;
      const inside =
        point.x >= box.left / meme.width &&
        point.x <= box.right / meme.width &&
        point.y >= box.top / meme.height &&
        point.y <= box.bottom / meme.height;
      if (inside) {
        onSelect(text.id);
        dragRef.current = { id: text.id, dx: point.x - text.x, dy: point.y - text.y };
        canvasRef.current.setPointerCapture(event.pointerId);
        return;
      }
    }
    onSelect(null);
  }

  /**
   * Déplace le bloc en cours de glisser.
   *
   * Args:
   *   event (PointerEvent): Mouvement du pointeur.
   *
   * Notes:
   *   clamp() borne les positions à 0,02–0,98 pour qu'un bloc reste toujours
   *   partiellement visible.
   */
  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const point = pointerFraction(event);
    onMove(
      dragRef.current.id,
      clamp(point.x - dragRef.current.dx, 0.02, 0.98),
      clamp(point.y - dragRef.current.dy, 0.02, 0.98),
    );
  }

  /** Termine le glisser en libérant la référence au bloc actif. */
  function stopDrag() {
    dragRef.current = null;
  }

  if (!meme) {
    return (
      <div className="canvas-empty">
        <h2>Aucune image chargée</h2>
        <p>Importez une image pour commencer, ou utilisez l’image d’exemple.</p>
      </div>
    );
  }

  return (
    <div className="canvas-frame">
      <div className="canvas-meta">
        <span>Aperçu — {meme.width} × {meme.height} px</span>
        <span>Cliquez sur un texte pour le déplacer.</span>
      </div>
      <canvas
        ref={canvasRef}
        className="meme-canvas"
        role="img"
        aria-label={`Aperçu du mème : ${meme.texts.map((t) => t.content).join(' / ') || 'sans texte'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
    </div>
  );
}
