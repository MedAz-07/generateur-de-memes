/**
 * Rendu du mème sur canvas.
 *
 * Rôle dans le projet : c'est la seule fonction de dessin de l'application.
 * L'aperçu de l'éditeur, les miniatures de la galerie et l'export appellent
 * tous `drawMeme()`, avec un facteur d'échelle différent. Ce qu'on voit est
 * donc exactement ce qu'on télécharge.
 *
 * Convention importante : toutes les positions (x, y) et la taille de police
 * sont des fractions de la largeur (0→1), pas des pixels absolus. Le rendu
 * reste proportionnel quelle que soit l'image ou l'échelle demandée.
 *
 * Utilisé par : MemeCanvas.jsx, MemeThumbnail.jsx, share.js.
 */

export const FONT_FAMILIES = {
  Impact: 'Impact, "Arial Black", sans-serif',
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Courier New': '"Courier New", Courier, monospace',
};

export const FONT_NAMES = Object.keys(FONT_FAMILIES);

/**
 * Borne une valeur entre un minimum et un maximum.
 *
 * Args:
 *   value (number): Valeur à borner.
 *   min (number): Borne inférieure.
 *   max (number): Borne supérieure.
 *
 * Returns:
 *   number: Valeur comprise entre min et max.
 *
 * Notes:
 *   Sert à empêcher un bloc de texte de sortir complètement du canvas pendant
 *   le glisser-déposer.
 */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Construit la chaîne `font` du contexte canvas pour un bloc de texte.
 *
 * Args:
 *   text (object): Bloc de texte, notamment fontSize (fraction de la largeur),
 *     fontFamily et bold.
 *   width (number): Largeur logique du canvas, sert à convertir fontSize en px.
 *
 * Returns:
 *   string: Chaîne CSS utilisable via `ctx.font` (ex. '700 90px Impact, …').
 *
 * Notes:
 *   Une police absente du système est remplacée par la pile de secours définie
 *   dans FONT_FAMILIES ; Impact reste le choix par défaut.
 */
export function fontString(text, width) {
  const px = Math.max(12, Math.round((text.fontSize ?? 0.075) * width));
  const family = FONT_FAMILIES[text.fontFamily] || FONT_FAMILIES.Impact;
  return `${text.bold === false ? '400' : '700'} ${px}px ${family}`;
}

/**
 * Découpe un texte en lignes qui tiennent dans une largeur donnée.
 *
 * Args:
 *   ctx (CanvasRenderingContext2D): Contexte dont la police est déjà définie ;
 *     `measureText` sert à mesurer chaque ligne.
 *   content (string): Texte saisi, pouvant contenir des retours à la ligne.
 *   maxWidth (number): Largeur maximale autorisée en pixels.
 *
 * Returns:
 *   string[]: Lignes à dessiner, dans l'ordre. Les paragraphes vides donnent
 *     une chaîne vide afin de conserver l'espacement.
 *
 * Notes:
 *   Les retours à la ligne explicites sont respectés ; un mot isolé plus large
 *   que `maxWidth` est laissé tel quel puis réduit par `fillText` lors du dessin.
 */
function wrapLines(ctx, content, maxWidth) {
  const paragraphs = String(content ?? '').split('\n');
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    lines.push(current);
  });
  return lines.length ? lines : [''];
}

/**
 * Calcule la mise en page complète d'un bloc de texte.
 *
 * Args:
 *   ctx (CanvasRenderingContext2D): Contexte de dessin ; la fonction y définit
 *     `ctx.font` avant de mesurer les lignes.
 *   text (object): Bloc de texte (contenu, style, x, y).
 *   width (number): Largeur logique du mème.
 *   height (number): Hauteur logique du mème.
 *
 * Returns:
 *   object: Mise en page contenant :
 *     px (number) : taille de police calculée ;
 *     lines (string[]) : lignes après retour automatique ;
 *     lineHeight, startY, originX (number) : coordonnées de dessin ;
 *     align (string) : 'left' | 'center' | 'right' ;
 *     box ({left, right, top, bottom}) : rectangle de sélection, en pixels.
 *
 * Notes:
 *   `drawMeme()` utilise ces valeurs pour dessiner ; `MemeCanvas` réutilise
 *   `box` pour détecter le clic et le glisser-déposer. Modifier le calcul ici
 *   met à jour les deux comportements en même temps.
 */
export function layoutText(ctx, text, width, height) {
  const px = Math.max(12, Math.round((text.fontSize ?? 0.075) * width));
  ctx.font = fontString(text, width);
  const raw = text.uppercase === false ? text.content ?? '' : String(text.content ?? '').toUpperCase();
  const lines = wrapLines(ctx, raw, width * 0.92);
  const lineHeight = px * 1.14;

  const align = ['left', 'center', 'right'].includes(text.align) ? text.align : 'center';
  const cx = clamp(text.x ?? 0.5, 0, 1) * width;
  const cy = clamp(text.y ?? 0.5, 0, 1) * height;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  const maxLineWidth = Math.max(1, ...lines.map((line) => ctx.measureText(line).width));

  const originX =
    align === 'left' ? width * 0.04 : align === 'right' ? width * 0.96 : cx;
  const left =
    align === 'center' ? originX - maxLineWidth / 2 : align === 'right' ? originX - maxLineWidth : originX;

  const pad = px * 0.22;
  return {
    px,
    lines,
    lineHeight,
    startY,
    originX,
    align,
    box: {
      left: left - pad,
      right: left + maxLineWidth + pad,
      top: startY - lineHeight / 2 - pad,
      bottom: startY + (lines.length - 1) * lineHeight + lineHeight / 2 + pad,
    },
  };
}

/**
 * Dessine le fond puis tous les blocs de texte sur un contexte donné.
 *
 * Args:
 *   ctx (CanvasRenderingContext2D): Contexte du canvas cible. Le canvas doit
 *     déjà avoir les dimensions `width * scale` × `height * scale`.
 *   meme (object): Mème à dessiner :
 *     background (CanvasImageSource) : image de fond, sans texte ;
 *     width, height (number) : dimensions logiques ;
 *     texts (object[]) : calques de texte.
 *   scale (number, optional): Facteur d'échelle. 1 pour l'aperçu et l'export,
 *     une valeur inférieure à 1 pour une miniature. Valeur par défaut : 1.
 *
 * Returns:
 *   void: Le dessin est écrit directement dans le contexte.
 *
 * Notes:
 *   La fonction entoure son travail de `save()` / `restore()` : elle ne laisse
 *   aucune modification de police, couleur ou transformation sur le contexte.
 *   Le texte est d'abord tracé en contour (`strokeText`) puis rempli
 *   (`fillText`) pour rester lisible sur n'importe quel fond.
 */
export function drawMeme(ctx, meme, scale = 1) {
  if (!meme || !meme.background) return;
  const { width, height, texts = [] } = meme;

  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(meme.background, 0, 0, width, height);

  texts.forEach((text) => {
    const layout = layoutText(ctx, text, width, height);
    ctx.textAlign = layout.align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = layout.px * (text.strokeWidth ?? 0.08);
    ctx.strokeStyle = text.strokeColor || '#101018';
    ctx.fillStyle = text.color || '#ffffff';

    layout.lines.forEach((line, index) => {
      const y = layout.startY + index * layout.lineHeight;
      if (ctx.lineWidth > 0) ctx.strokeText(line, layout.originX, y, width * 0.94);
      ctx.fillText(line, layout.originX, y, width * 0.94);
    });
  });

  ctx.restore();
}
