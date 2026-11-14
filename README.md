# Générateur de mèmes

Application web sans serveur : on importe une image, on ajoute du texte, on voit le résultat en direct, on télécharge ou partage, et on retrouve ses créations dans une galerie persistante.

> Lien public du site : [https://generateur-de-memes-1.vercel.app/](https://generateur-de-memes-rouge.vercel.app/)

---

## 1. Fonctionnalités (correspondance avec le sujet)

| Exigence du PDF           | Implémentation                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Téléchargement d'images   | Sélecteur de fichier + glisser-déposer, JPG / PNG / WebP, 10 Mo max, validation avec message d'erreur clair. Une image d'exemple générée localement permet d'essayer sans fichier.         |
| Ajout de texte            | Blocs de texte illimités : contenu multiligne, police, taille, couleur, contour (couleur + épaisseur), gras, majuscules, alignement, et déplacement par glisser-déposer sur le canvas.     |
| Aperçu en temps réel      | Le canvas est redessiné à chaque modification, sans bouton « Appliquer ».                                                                                                                  |
| Téléchargement et partage | Export PNG ou JPG en pleine résolution ; partage via Web Share API (fichier) avec replis presse-papiers / liens de réseaux sociaux / téléchargement.                                       |
| Galerie                   | Grille des mèmes, aperçu grand format, téléchargement, **ré-édition**, suppression avec confirmation, tri du plus récent au plus ancien. Persiste après F5 et après fermeture de l'onglet. |

Extras : barre de suivi du quota, export/import de la galerie en JSON, interface responsive, états vides et d'erreur, accessibilité clavier.

---

## 2. Stack et lancement

**Vite + React (JavaScript / JSX) + HTML Canvas + CSS vanilla + LocalStorage.**  
Deux dépendances runtime (`react`, `react-dom`) : le code reste court et lisible. L'interface utilise une palette neutre, des bordures fines et aucun effet décoratif.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # build statique dans dist/
npm run preview   # prévisualiser le build
```

Le déploiement est un simple hébergement de fichiers statiques (`dist/`), avec `base: './'` dans `vite.config.js` pour fonctionner à n'importe quelle URL. **HTTPS est requis** pour la Web Share API et le presse-papiers.

---

## 3. Architecture

```
src/
├── main.jsx, App.jsx        # état global, 2 vues (Éditeur / Galerie), orchestration
├── styles.css               # une seule feuille de style
├── components/
│   ├── Dropzone.jsx         # FR-01 import + validation
│   ├── MemeCanvas.jsx       # FR-03 preview + déplacement des textes
│   ├── TextControls.jsx     # FR-02 personnalisation
│   ├── Toolbar.jsx          # FR-04 + sauvegarde
│   ├── Gallery.jsx          # FR-05
│   ├── MemeThumbnail.jsx    # miniatures recalculées à la volée
│   ├── ConfirmDialog.jsx    # confirmations de suppression / import
│   └── ShareDialog.jsx      # replis de partage
└── lib/
    ├── drawMeme.js          # fonction de rendu commune
    ├── image.js             # lecture, validation, redimensionnement, compression
    ├── storage.js           # accès au LocalStorage
    ├── share.js             # export + Web Share + replis
    └── id.js
```

### Le principe central

`drawMeme(ctx, meme, scale)` est **la seule fonction qui dessine**. Le preview l'appelle avec `scale = 1`, les miniatures de la galerie avec `scale ≈ 0.36`, l'export avec `scale = 1` sur un canvas hors écran. Résultat : **ce qu'on voit est exactement ce qu'on télécharge**, et il n'y a qu'un seul endroit à comprendre ou à corriger.

`layoutText()` calcule le retour à la ligne, l'origine et la boîte de sélection d'un bloc : `drawMeme()` s'en sert pour dessiner, `MemeCanvas` s'en sert pour détecter le clic et le glisser-déposer.

Toutes les positions (`x`, `y`) et toutes les tailles (`fontSize`, `strokeWidth`) sont **relatives** (fractions de la largeur / de la taille du texte) : le rendu reste proportionnel quelle que soit l'image.

### Reprendre le projet après plusieurs mois

Les fichiers source portent des commentaires au format Google (`Args`, `Returns`, `Raises`, `Props`, `Notes`). Pour retrouver rapidement le fil, lire dans cet ordre :

1. `src/lib/drawMeme.js` — la seule fonction de dessin ; comprendre `layoutText()` avant le reste.
2. `src/lib/image.js` — comment un fichier devient une image, puis un fond compressé.
3. `src/lib/storage.js` — ce qui est réellement sauvegardé et pourquoi le quota est surveillé.
4. `src/App.jsx` — l'en-tête du fichier contient la carte complète des états et des gestionnaires.
5. `src/components/MemeCanvas.jsx` — le seul composant avec de la logique (glisser-déposer).
6. `src/lib/share.js` — export et partage, à lire en dernier.

Trois points à ne pas oublier :

- `meme.background` est un `HTMLImageElement` dans l'éditeur, mais un **DataURL** dans la galerie. Les conversions se font dans `handleSave()` et `handleEdit()` de `App.jsx`.
- Le stockage dépend de l'origine : une galerie créée sur `localhost` n'existe pas sur le site déployé.
- Le partage natif exige HTTPS ; sur desktop sans presse-papiers image, la modale de repli prend le relais.

---

## 4. Données et persistance

Clé `meme-gallery:v1` dans `localStorage` :

```js
{
  version: 1,
  memes: [{
    id, createdAt, title, width, height,
    background: "data:image/jpeg;base64,...", // LE FOND SEUL, sans texte
    texts: [ /* calques : contenu, style, x, y */ ],
    bytes
  }]
}
```

**Pourquoi le fond seul ?** Si l'on stockait le mème déjà aplati *avec* son texte, rouvrir le mème pour le modifier dessinerait le texte une seconde fois. Stocker le fond + les calques donne une ré-édition fidèle **et** une seule image par mème.

**Pourquoi ça tient dans ~5 Mo ?**

1. L'image est redimensionnée à **1280 px max** sur le plus grand côté.
2. Elle est encodée en **JPEG qualité 0,78** → ~30–200 Ko par mème (au lieu de plusieurs Mo en DataURL brut).
3. Aucune miniature n'est stockée : elle est redessinée à la volée par `drawMeme()`.
4. `storage.js` estime la taille avant d'écrire, affiche une alerte à 80 % et transforme `QuotaExceededError` en **message actionnable** (« supprime un ancien mème ou exporte en JSON ») au lieu d'un plantage silencieux.

> Le LocalStorage est lié à l'origine (domaine + port) : une galerie créée sur `localhost` n'apparaît pas sur le site déployé. Il faut donc tester la galerie sur l'URL publique. Vider le cache du navigateur efface la galerie, d'où l'export/import JSON.

**Migration éventuelle vers IndexedDB** : toutes les lectures/écritures passent par `src/lib/storage.js`. Remplacer ce fichier par un wrapper IndexedDB suffit, sans toucher aux composants.

---

## 5. Pourquoi pas de backend ?

Le sujet ne demande ni base de données serveur, ni authentification, ni API. Toutes les fonctionnalités sont réalisables côté navigateur. Ajouter un serveur aurait impliqué un hébergement payant, des comptes, et l'envoi d'images personnelles sur une machine distante — sans bénéfice pour le cahier des charges. Ici **aucune image ne quitte l'appareil**.

### La limite honnête du « partage sur les réseaux sociaux »

Une application 100 % Frontend ne peut **pas** publier une image sur le compte d'un utilisateur (il faudrait OAuth + une API serveur). Le partage est donc implémenté ainsi :

1. **Web Share API avec fichier** (`navigator.canShare({ files })`) sur mobile / HTTPS → le sélecteur natif du système propose WhatsApp, Instagram, X, etc. C'est le vrai partage de l'image.
2. **Repli desktop** : copie de l'image dans le presse-papiers via `ClipboardItem`.
3. **Repli universel** : liens d'intent (X, Facebook, WhatsApp) qui partagent le **lien du site**, + bouton de téléchargement pour publier soi-même l'image.

---

## 6. Limites connues

- ~5 Mo de stockage par origine, soit une vingtaine de mèmes selon les images. Au-delà : message clair + export JSON.
- Pas de synchronisation entre appareils, pas de comptes (choix assumé, hors périmètre).
- Publication automatique sur un réseau social impossible sans backend (voir ci-dessus).
- Images distantes volontairement exclues : elles rendraient le canvas « tainted » (CORS) et interdiraient l'export, en plus des questions de droits d'auteur.
- Le rendu dépend des polices installées (`Impact` peut être absente sur certains appareils → repli `Arial Black`).

---

## 7. FAQ de soutenance

**Q. Pourquoi LocalStorage et pas IndexedDB ?**  
Pour la simplicité et parce que le code doit être explicable : 2 lignes de code, synchrone, sérialisable. IndexedDB est plus robuste (Blob, gros quota) mais ajoute transactions / callbacks / versioning. Les garde-fous (compression, quota, module isolé) rendent LocalStorage suffisant ici, et `storage.js` garde la porte ouverte à une migration.

**Q. Comment fonctionne l'aperçu en temps réel ?**  
L'état React est la source de vérité. Chaque frappe met à jour `meme.texts`, ce qui redéclenche l'effet de `MemeCanvas`, qui appelle `drawMeme()` dans un `requestAnimationFrame`. Aucune validation manuelle, aucun double rendu.

**Q. Comment la galerie survit-elle au refresh ?**  
À l'enregistrement, le fond est compressé puis sérialisé avec les calques dans `localStorage`. Au démarrage, `loadGallery()` relit la clé. Les miniatures sont recalculées depuis ces données.

**Q. Pourquoi stocker le fond et pas l'image finale ?**  
Pour pouvoir ré-éditer sans superposer du texte déjà « cuit » dans l'image (voir §4).

**Q. Où sont les données personnelles ?**  
Nulle part ailleurs que dans le navigateur de l'utilisateur : aucun appel réseau métier, aucun cookie, aucun analytics.

**Q. D'où vient l'image d'exemple ?**  
Elle est dessinée à la volée sur un canvas (`makeSampleImage()`), sans aucun asset tiers : aucun problème de propriété intellectuelle, aucun CORS.

---

## 8. Propriété intellectuelle


Aucun visuel, template ou police tiers n'est embarqué. Les images sont **fournies par l'utilisateur** ou **générées localement**. Le code et l'interface ont été réalisés pour ce projet ; aucun document source ni visuel protégé n'est reproduit.

---

## 9. Recette

Checklist complète dans `SPEC.md` §5. Vérification dans Chrome après la refonte de l'interface : validation MIME, rendu canvas, aperçu temps réel, ajout de bloc, export PNG, écriture LocalStorage, compression effective, persistance après rechargement, ré-édition fidèle, repli de partage (3 liens), responsive mobile sans débordement, aucune erreur console → tous les contrôles réussis.

```
npm run build     # aucune erreur
```

---

*Document de cadrage : `SPEC.md` (PRD, 8 phases, matrice de traçabilité, risques).*
