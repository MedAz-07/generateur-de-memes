/**
 * Lecture, validation et compression des images.
 *
 * Rôle dans le projet : transformer un fichier choisi par l'utilisateur en un
 * élément `HTMLImageElement` utilisable sur un canvas, puis produire le fond
 * JPEG compressé qui sera sauvegardé dans la galerie. Tout se passe dans le
 * navigateur : aucun fichier n'est envoyé sur un serveur.
 *
 * Constantes utiles : MAX_FILE_SIZE (10 Mo), MAX_DIMENSION (1280 px),
 * BACKGROUND_QUALITY (0.78). Ces trois valeurs déterminent le budget de
 * stockage LocalStorage d'environ 5 Mo (voir storage.js).
 *
 * Utilisé par : App.jsx, Dropzone.jsx, MemeCanvas.jsx, MemeThumbnail.jsx, storage.js.
 */

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_DIMENSION = 1280;
export const BACKGROUND_QUALITY = 0.78;

/**
 * Formate un nombre d'octets pour l'affichage de la barre de quota.
 *
 * Args:
 *   bytes (number): Taille brute en octets.
 *
 * Returns:
 *   string: Valeur lisible, en o, Ko ou Mo (ex. '27.4 Ko').
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 o';
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

/**
 * Vérifie le type et la taille d'un fichier avant toute lecture.
 *
 * Args:
 *   file (File|null): Fichier issu du sélecteur ou du glisser-déposer.
 *
 * Returns:
 *   string|null: Message d'erreur en français, ou null si le fichier est valide.
 *
 * Notes:
 *   Le contrôle porte sur `file.type` (MIME déclaré par le navigateur), pas
 *   sur les octets du fichier : c'est suffisant pour cet usage local.
 */
export function validateFile(file) {
  if (!file) return 'Aucun fichier sélectionné.';
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Format non pris en charge. Choisissez une image JPG, PNG ou WebP.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Image trop lourde (${formatBytes(file.size)}). La limite est de 10 Mo.`;
  }
  return null;
}

/**
 * Lit un fichier image et retourne un élément prêt à être dessiné.
 *
 * Chaîne de traitement : FileReader -> DataURL -> Image. Le DataURL est
 * conservé dans le résultat pour éviter d'avoir à révoquer une URL d'objet
 * quand l'utilisateur change de fichier.
 *
 * Args:
 *   file (File): Fichier local à valider puis décoder.
 *
 * Returns:
 *   Promise<object>: Objet contenant :
 *     image (HTMLImageElement) : image décodée, utilisable par drawImage ;
 *     src (string) : DataURL d'origine ;
 *     width, height (number) : dimensions natives ;
 *     name (string) : nom du fichier.
 *
 * Raises:
 *   Error: Si le type ou la taille sont refusés, si la lecture échoue ou si
 *     le navigateur ne parvient pas à décoder l'image. Le message est affiché
 *     directement à l'utilisateur.
 */
export function readImageFile(file) {
  const problem = validateFile(file);
  if (problem) return Promise.reject(new Error(problem));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () =>
        resolve({
          image: img,
          src: reader.result,
          width: img.naturalWidth,
          height: img.naturalHeight,
          name: file.name,
        });
      img.onerror = () => reject(new Error("Impossible de décoder cette image."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Recharge une image à partir d'un DataURL sauvegardé dans la galerie.
 *
 * Args:
 *   src (string): DataURL du fond compressé d'un mème enregistré.
 *
 * Returns:
 *   Promise<HTMLImageElement>: Image décodée, prête pour drawMeme().
 *
 * Raises:
 *   Error: Si le DataURL n'est plus lisible.
 *
 * Notes:
 *   Appelée lors de la ré-édition, du téléchargement depuis la galerie et du
 *   dessin des miniatures (MemeThumbnail).
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image enregistrée."));
    img.src = src;
  });
}

/**
 * Réduit des dimensions sans dépasser une borne sur le plus grand côté.
 *
 * Args:
 *   width (number): Largeur d'origine.
 *   height (number): Hauteur d'origine.
 *   max (number, optional): Plus grand côté autorisé. Valeur par défaut :
 *     MAX_DIMENSION (1280).
 *
 * Returns:
 *   {width: number, height: number}: Dimensions entières, proportions gardées.
 *
 * Notes:
 *   Une image plus petite que `max` n'est pas agrandie. Des dimensions nulles
 *   donnent 1 × 1 pour éviter un canvas de taille zéro.
 */
export function fitDimensions(width, height, max = MAX_DIMENSION) {
  if (!width || !height) return { width: 1, height: 1 };
  if (Math.max(width, height) <= max) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const ratio = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Compresse une source (Image ou Canvas) dans un DataURL.
 *
 * Un fond uni est peint avant le dessin pour les formats sans transparence :
 * sinon les zones transparentes d'un PNG deviendraient noires à l'encodage.
 *
 * Args:
 *   source (CanvasImageSource): Image ou canvas à aplatir.
 *   width (number): Largeur du canvas de sortie.
 *   height (number): Hauteur du canvas de sortie.
 *   options (object, optional): Réglages d'encodage :
 *     type (string) : MIME de sortie, 'image/jpeg' par défaut ;
 *     quality (number) : qualité 0→1, BACKGROUND_QUALITY par défaut ;
 *     fill (string) : couleur de fond, gris-bleu neutre par défaut.
 *
 * Returns:
 *   string: DataURL prêt à être stocké dans LocalStorage.
 *
 * Notes:
 *   C'est cette fonction qui rend la galerie viable : une photo de plusieurs
 *   Mo est ramenée à quelques dizaines de Ko.
 */
export function canvasToDataUrl(source, width, height, options = {}) {
  const { type = 'image/jpeg', quality = BACKGROUND_QUALITY, fill = '#84929f' } = options;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

/**
 * Dessine l'image d'exemple proposée quand aucun fichier n'est importé.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   string: DataURL JPEG 1200 × 800, composé d'un ciel gris-bleu, d'un
 *     horizon, d'une ligne et d'un disque clair.
 *
 * Notes:
 *   Le visuel est généré sur un canvas : aucun asset tiers, aucun appel
 *   réseau, donc aucun problème de droits ni de CORS. Il reste volontairement
 *   neutre pour ne pas donner à l'interface un aspect décoratif.
 */
export function makeSampleImage() {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#84929f';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#505e6b';
  ctx.fillRect(0, 560, width, height - 560);
  ctx.fillStyle = '#3e4c58';
  ctx.fillRect(0, 557, width, 3);
  ctx.fillStyle = '#f0ece1';
  ctx.beginPath();
  ctx.arc(940, 205, 100, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/jpeg', 0.88);
}
