# SPEC.md — Générateur de mèmes

> **Document de cadrage : PRD + découpage en phases** — version 1.6 — 14/11/2026  
> Statut : document de référence, projet terminé.

---

## 0. Contexte et objectif

### 0.1 Source

Le cahier des charges demande :

> « Développer un générateur de mèmes en ligne où les utilisateurs peuvent télécharger des images, ajouter du texte, et créer rapidement des mèmes. Application doit permettre de visualiser, télécharger et partager les mèmes créés. »

Fonctionnalités demandées :

1. **Téléchargement d'images** : depuis l'ordinateur de l'utilisateur.
2. **Ajout de texte** : texte personnalisé sur l'image.
3. **Aperçu en temps réel** : visualisation instantanée des modifications.
4. **Téléchargement et partage** : télécharger les mèmes créés et les partager sur les réseaux sociaux.
5. **Galerie** : section pour visualiser les mèmes précédemment créés.

Le cahier des charges contient également une note de **propriété intellectuelle / autorisation d'usage** : à respecter (voir §1.7 et §6).

Le livrable attendu est une URL publique, ouvrable depuis n'importe quel navigateur ou téléphone, avec les cinq fonctionnalités opérationnelles et un code que son auteur peut expliquer lui-même.

### 0.2 Contraintes retenues

| #  | Contrainte                                                                                     |
| -- | ---------------------------------------------------------------------------------------------- |
| C1 | 100 % Frontend, **aucune** donnée envoyée à un serveur, aucune image uploadée en ligne         |
| C2 | Aucun compte, aucune authentification, aucun backend, aucun coût d'hébergement                 |
| C3 | Persistance locale de la galerie après F5 / fermeture d'onglet                                 |
| C4 | Code lisible, commenté, peu de dépendances, **explicable à l'oral**                            |
| C5 | Cible : Chrome / Edge / Firefox / Safari, desktop + mobile récents                             |
| C6 | HTTPS obligatoire en prod (requis par Web Share API et Clipboard API → fourni par l'hébergeur) |
| C7 | Respect de la note de propriété intellectuelle du sujet                                        |

---

## 1. PRD — Product Requirements Document

### 1.1 Vision

Un outil web unique, immédiat, sans inscription : je choisis une image de mon PC/téléphone, j'écris mon texte, je vois le résultat en direct, je télécharge ou je partage, et je retrouve mes créations dans une galerie qui reste sur mon navigateur.

### 1.2 Utilisateur cible

Un utilisateur qui ouvre le lien sur desktop ou mobile et veut créer un mème en moins de 30 secondes, sans tutoriel ni inscription.

### 1.3 Dans le périmètre (In scope)

- Import d'image locale, glisser-déposer ou sélecteur de fichier.
- Édition de blocs de texte (contenu + style + position).
- Rendu Canvas en temps réel.
- Export image (PNG / JPEG) en résolution exploitable.
- Partage via les mécanismes natifs du navigateur + replis explicites.
- Galerie persistante avec consultation, re-téléchargement, ré-édition, suppression.
- Interface responsive, états vides / erreurs propres, README.

### 1.4 Hors périmètre (Out of scope) — à assumer en soutenance

- Backend, API, base de données serveur, comptes utilisateurs, authentification.
- Stockage « cloud » / synchronisation entre appareils.
- **Publication automatique d'une image sur un réseau social** (impossible sans backend et sans autorisations OAuth ; voir §1.6 / FR-04).
- Bibliothèque de templates d'images distants (évite les problèmes de droits d'auteur **et** de Canvas « tainted » / CORS).
- Édition avancée type filtres, stickers, calques multiples, undo/redo illimité.
- Collaboration multi-utilisateurs.

### 1.5 Exigences fonctionnelles (FR)

| ID        | Exigence (source)                  | Critère d'acceptation                                                                                                                                                                                                                                                                                                                                                    | Phase   |
| --------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **FR-01** | Téléchargement d'images (PDF §1)   | Sélecteur de fichier **et** drag & drop ; `image/jpeg`, `png`, `webp` acceptés ; limite 10 Mo ; message d'erreur clair si type/taille invalide ; l'image est chargée depuis un `File`/`Blob` local, jamais depuis une URL distante                                                                                                                                       | P2      |
| **FR-02** | Ajout de texte (PDF §2)            | 2 blocs par défaut (haut / bas) ; ajout et suppression de blocs ; saisie multiligne ; police, taille, couleur, couleur de contour, gras, alignement, retour à la ligne automatique ; déplacement à la souris/tactile ou champs X/Y                                                                                                                                       | P3      |
| **FR-03** | Aperçu en temps réel (PDF §3)      | Chaque frappe / changement de style redessine le canvas sans bouton « Appliquer » ; rendu < 100 ms ; le preview est mis à l'échelle, l'export utilise la **même** fonction de dessin en pleine résolution                                                                                                                                                                | P2 → P3 |
| **FR-04** | Téléchargement et partage (PDF §4) | Bouton « Télécharger » → PNG (ou JPEG) en résolution native plafonnée à 1600 px, nom `meme-AAAA-MM-JJ-HHmm.png` ; bouton « Partager » → Web Share API avec fichier quand disponible, sinon repli : copie dans le presse-papiers → intents réseaux sociaux (lien du site + texte) → téléchargement + consigne ; un texte court explique la limite du partage sans backend | P4      |
| **FR-05** | Galerie (PDF §5)                   | Grille des mèmes du plus récent au plus ancien : miniature, titre, date ; actions *voir / télécharger / ré-éditer / supprimer* (avec confirmation) ; **les mèmes sont toujours présents après F5 et après fermeture/réouverture de l'onglet** ; état vide avec appel à l'action                                                                                          | P5      |
| **FR-06** | Ergonomie transverse (ajout)       | Responsive desktop/mobile ; états vide / chargement / erreur ; labels accessibles, navigation clavier, `alt` sur les miniatures ; aucune donnée externe chargée                                                                                                                                                                                                          | P1 → P6 |

### 1.6 Décision délicate : « partager sur les réseaux sociaux » sans backend

Le PDF demande le partage, mais une application 100 % Frontend ne peut **pas** publier une image sur le compte d'un utilisateur. Décision assumée et documentée :

1. **Web Share API + fichier** (`navigator.canShare({ files })`) sur mobile/HTTPS : le sélecteur natif du système propose WhatsApp, Instagram, X, etc. → c'est le vrai « partage vers les réseaux sociaux ».
2. **Repli desktop** : copie de l'image dans le presse-papiers (`ClipboardItem`) si disponible.
3. **Repli universel** : liens d'intent (X, Facebook, WhatsApp) qui partagent **le lien du site** + un texte, et bouton de téléchargement pour que l'utilisateur publie lui-même l'image.
4. Un bandeau d'aide d'une ligne dans l'UI + un paragraphe dans le README expliquant pourquoi.

> Ce point est à connaître par cœur : c'est la question la plus probable en soutenance.

### 1.7 Exigences non fonctionnelles (NFR)

| ID         | Exigence           | Mesure                                                                                                                              |
| ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-01** | Performance        | Dessin via `requestAnimationFrame`, aucune re-compression inutile à chaque frappe                                                   |
| **NFR-02** | Budget de stockage | ~5 Mo/origine en LocalStorage → **≤ 150–200 Ko par mème**, alerte dès 80 % du quota, `QuotaExceededError` géré sans crash           |
| **NFR-03** | Confidentialité    | Tout reste dans le navigateur ; aucun appel réseau métier ; mention visible « Vos images ne quittent pas votre appareil »           |
| **NFR-04** | Sécurité           | Pas de `dangerouslySetInnerHTML`, validation du type MIME, pas d'image distante (Canvas non « tainted » → export toujours possible) |
| **NFR-05** | Simplicité         | ≤ 2 dépendances runtime (`react`, `react-dom`), Vite en dev uniquement, CSS vanilla, fonctions pures isolées                        |
| **NFR-06** | Résilience         | Vider le cache du navigateur efface la galerie → message d'avertissement + (bonus P5) export/import de la galerie en JSON           |
| **NFR-07** | Traçabilité        | Chaque exigence du PDF ↔ une FR ↔ une phase ↔ un test de recette (§5)                                                               |

### 1.8 Décision technique : **LocalStorage retenu, avec garde-fous**

Question posée : « IndexedDB ou LocalStorage ? » → **Oui au LocalStorage pour ce mini-projet, mais pas naïvement.**

| Critère                        | LocalStorage                                     | IndexedDB                                                      |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| Simplicité / explicabilité     | Élevée : 2 lignes de code                        | Moyenne : wrapper async, transactions, `onsuccess`, versioning |
| Données stockées               | **string uniquement** (base64 = +33 % de volume) | `Blob` / `File` natifs, binaires                               |
| Quota                          | **~5 Mo par origine**                            | plusieurs centaines de Mo                                      |
| Accès                          | synchrone (bloquant)                             | asynchrone                                                     |
| Persistance après F5           | Oui                                              | Oui                                                            |
| Adapté à un devoir à expliquer | Oui                                              | Plus lourd à justifier                                         |

**Le risque réel** : une photo de téléphone (2–4 Mo) convertie en DataURL remplit le quota au bout de 2 mèmes. La galerie « marche » en démo puis casse silencieusement.

**Les 5 garde-fous obligatoires :**

1. **Une seule image par mème : le fond compressé (sans texte) + les calques de texte en JSON.** Le mème « final » est recalculé à la volée par `drawMeme` pour le preview, les miniatures de la galerie et l'export. Affinement apporté avant le code : stocker le mème *aplati* + les calques aurait produit du **texte en double** à la ré-édition. Un seul fichier image et la ré-édition reste fidèle.
2. **Redimensionner** à 1280 px max sur le plus grand côté et encoder en **JPEG qualité ≈ 0,78** (ou WebP si supporté) → ~100–200 Ko par mème → ~25 mèmes avant saturation, largement suffisant pour une démo.
3. Conserver les **métadonnées de texte** (JSON) pour permettre la ré-édition sans ré-upload.
4. **Gérer le quota** : `try/catch`, estimation `JSON.stringify(...).length`, alerte à 80 %, message actionnable (« supprime un ancien mème ou exporte la galerie ») plutôt qu'une erreur blanche.
5. **Isoler tout accès au stockage dans un seul module `src/lib/storage.js`** → c'est la vraie décision d'architecture : passer à IndexedDB plus tard = **un seul fichier à modifier**, zéro impact sur l'UI.

> Verdict : LocalStorage est le bon choix vu C4 (code explicable) **à condition** d'appliquer 1–5. Si le besoin évolue (galerie illimitée, originaux haute définition), la **Phase 4-bis / migration IndexedDB** est déjà prévue sans refonte.

### 1.9 Définition de « terminé » (DoD)

- [ ] Les 5 fonctionnalités du PDF sont démontrables sur l'URL publique.
- [ ] Créer 3 mèmes → F5 → les 3 sont toujours dans la galerie.
- [ ] L'export PNG s'ouvre correctement hors de l'application.
- [ ] L'URL s'ouvre en navigation privée et sur un téléphone.
- [ ] Aucune erreur bloquante dans la console, aucun appel réseau métier.
- [ ] `README.md` : lancement, architecture, limites connues, explication du code.
- [ ] Je peux expliquer en 3 minutes : le rendu Canvas, la persistance, et la limite du partage.

---

### 1.10 Charte d'interface (ajoutée lors de la refonte UI/UX)

Objectif : une interface simple, moderne et professionnelle, sans effet démonstratif.

- Palette neutre : fond clair `#f7f7f5`, surfaces blanches, texte `#1b1d21`, accent bleu marine `#243b53`.
- Aucun dégradé, glow, ombre portée, glassmorphism, animation décorative ou emoji dans l'interface.
- Bordures fines (1 px), rayons de 4 à 6 px, boutons pleins ou contours, navigation par onglets soulignés.
- Copy factuelle et au vouvoiement : pas de slogan, pas de promesse marketing, pas de « astuce ».
- Hiérarchie : libellés de section en petites capitales, champs alignés sur deux colonnes, aperçu encadré.
- Les commentaires de code suivent le format Google docstring (`Args` / `Returns` / `Raises` / `Props` / `Notes`), sans en-têtes décoratifs, sans emoji et sans références internes au document. Voir le parcours de relecture du README §3.
- L'image d'exemple est un aplat neutre généré localement (horizon + disque), pas un visuel décoratif coloré.
- Accessibilité conservée : labels, focus visible, navigation clavier, `alt`/`aria-label`, contrastes lisibles.


## 2. Architecture prévue

### 2.1 Stack

**Vite + React (JavaScript / JSX) + HTML Canvas + CSS vanilla + LocalStorage.**  
Pas de TypeScript, pas de librairie UI, pas de router : deux vues gérées par un simple état dans `App.jsx`. Objectif : le minimum de « magie » à expliquer.

### 2.2 Arborescence

```
Générateur_des_mémes/
├── SPEC.md                    ← ce document
├── README.md                  ← créé en P6
├── index.html
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                ← vue Éditeur / vue Galerie
    ├── styles.css
    ├── components/
    │   ├── Dropzone.jsx       ← import + validation (FR-01)
    │   ├── MemeCanvas.jsx     ← preview temps réel (FR-03)
    │   ├── TextControls.jsx   ← blocs de texte et styles (FR-02)
    │   ├── Toolbar.jsx        ← sauvegarder / télécharger / partager (FR-04)
    │   ├── Gallery.jsx        ← grille + actions (FR-05)
    │   └── ConfirmDialog.jsx
    └── lib/
        ├── drawMeme.js        ← FONCTION PURE : (ctx, meme, scale) → dessin
        ├── image.js           ← lecture de File, redimensionnement, compression
        ├── storage.js         ← SEUL point d'accès LocalStorage (clé versionnée)
        ├── share.js           ← Web Share API + replis
        └── id.js
```

### 2.3 Principe central

`drawMeme(ctx, state, scale)` est **la source de vérité unique** : le preview l'appelle avec `scale < 1`, l'export l'appelle avec `scale = 1` sur un canvas hors écran. Une seule logique de rendu → aucun décalage entre ce qu'on voit et ce qu'on télécharge, et un code très facile à expliquer.

### 2.4 Modèle de données

```js
// Clé : "meme-gallery:v1"  (versionnée pour anticiper une migration)
{
  version: 1,
  memes: [
    {
      id: "m_1731500000000",
      createdAt: "2026-11-13T12:00:00.000Z",
      title: "Mon mème",
      width: 1280,               // dimensions du rendu stocké
      height: 720,
      background: "data:image/jpeg;base64,...", // fond SEUL, compressé, ≤ ~200 Ko
      bytes: 184320,             // pour le suivi du quota
      texts: [                   // calques de texte, pour la ré-édition
        {
          id: "t_1", content: "QUAND TU CROIS QUE", x: 0.5, y: 0.08,
          fontSize: 56, fontFamily: "Impact", color: "#FFFFFF",
          strokeColor: "#000000", strokeWidth: 4, align: "center", bold: true
        }
      ]
    }
  ]
}
```

Les positions `x / y` sont **relatives (0→1)** : le mème reste correct quelle que soit la taille d'affichage. `fontSize` est aussi relatif (fraction de la largeur), pas des pixels absolus : un mème créé sur une petite image et un autre sur une grande gardent des proportions cohérentes.

**Aucune miniature n'est stockée** : `Gallery` redessine chaque carte à partir de `background` + `texts` via `drawMeme(ctx, meme, scale)` — une seule source de vérité, zéro octet gaspillé.

---

## 3. Découpage en phases

Chaque phase se termine par un état **démontrable**. Aucune phase ne commence si la précédente n'est pas validée.

### Phase 0 — Cadrage (terminé)

- **Objectif** : se mettre d'accord avant d'écrire la première ligne.
- **Tâches** : rédiger ce PRD, trancher les 4 décisions ouvertes (§4), initialiser le dossier.
- **Livrable** : `SPEC.md` validé.
- **Done when** : les choix « LocalStorage + garde-fous », « JS plutôt que TS », « mode de déploiement » et « ré-édition » sont confirmés.

### Phase 1 — Socle et maquette

- **Objectif** : une application qui démarre et une navigation en place.
- **Tâches** : `npm create vite` (React/JS), nettoyage du template, `App.jsx` avec 2 vues (Éditeur / Galerie), header, design tokens CSS, layout responsive, états vides.
- **Livrable** : `npm run dev` → interface propre, desktop + mobile.
- **Done when** : je clique sur « Galerie » puis « Éditeur », les deux vues s'affichent sans erreur console.

### Phase 2 — Cœur de l'éditeur *(FR-01 + FR-03)*

- **Objectif** : importer une image et la voir sur un Canvas.
- **Tâches** : `Dropzone.jsx` (input + drag & drop + validation MIME/taille), `image.js` (FileReader / `createObjectURL`), création de `drawMeme.js`, `MemeCanvas.jsx`, état React unique, rendu via `requestAnimationFrame`, premier texte par défaut.
- **Livrable** : l'image importée s'affiche, taper du texte modifie le canvas instantanément.
- **Done when** : j'importe un JPG/PNG → il apparaît ; je tape → le texte change sans cliquer sur « Appliquer » ; un fichier `.txt` est refusé avec un message clair.

### Phase 3 — Personnalisation du texte *(FR-02)*

- **Objectif** : un vrai générateur de mèmes, pas juste deux lignes.
- **Tâches** : liste de blocs de texte (ajout/suppression), contrôles police / taille / couleurs / contour / gras / alignement, retour à la ligne automatique dans la largeur du canvas, déplacement par glisser (souris + tactile), positions relatives.
- **Livrable** : panneau de contrôle complet branché sur `drawMeme`.
- **Done when** : 3 blocs avec des styles différents, aucun texte ne déborde, tout se met à jour en direct.

### Phase 4 — Export et partage *(FR-04)*

- **Objectif** : sortir le mème de l'application.
- **Tâches** : canvas hors écran pleine résolution, `toBlob` + téléchargement (`URL.createObjectURL` + `<a download>`), choix PNG/JPEG, `share.js` (Web Share avec fichier → ClipboardItem → intents → téléchargement), micro-copy expliquant la limite sans backend.
- **Livrable** : boutons « Télécharger » et « Partager » fonctionnels.
- **Done when** : le PNG téléchargé s'ouvre correctement ; sur mobile le sélecteur natif propose une appli ; sur desktop un repli fonctionne sans erreur.

### Phase 5 — Galerie persistante *(FR-05 + NFR-02/03/06)*

- **Objectif** : une galerie qui survit au rechargement de la page et à la fermeture de l'onglet.
- **Tâches** : `storage.js` (clé `meme-gallery:v1`, schéma versionné, `load/save/remove`), compression 1280 px / JPEG 0,78 avant sauvegarde, bouton « Enregistrer dans la galerie », grille + tri, voir / télécharger / ré-éditer (recharge l'état dans l'éditeur) / supprimer avec confirmation, suivi du quota avec alerte à 80 % et `try/catch QuotaExceededError`, état vide avec CTA, avertissement « vider le cache efface la galerie ». **Bonus** : export/import JSON de la galerie.
- **Livrable** : galerie persistante et robuste.
- **Done when** : je crée 3 mèmes → **F5** → les 3 sont là ; je ferme l'onglet → je reviens → ils sont là ; je supprime → confirmation → disparition ; quota simulé → message propre, application pas cassée.
- **Phase 4-bis (optionnelle)** : si le quota devient limitant, remplacer uniquement `storage.js` par un wrapper IndexedDB, sans toucher aux composants.

### Phase 6 — Finition, qualité et documentation *(FR-06 + DoD)*

- **Objectif** : présentable et défendable.
- **Tâches** : checklist de recette (§5), responsive sur petit écran, accessibilité (labels, focus visible, `alt`), gestion des états d'erreur, nettoyage du code + commentaires, `README.md` (installation, architecture, schéma de données, **limites connues**, note propriété intellectuelle du sujet, foire aux questions « pourquoi pas de backend ? » / « pourquoi LocalStorage ? » / « comment marche le partage ? »).
- **Livrable** : build de production sans warning bloquant + README.
- **Done when** : `npm run build` passe, la checklist §5 est entièrement cochée, je peux expliquer le code sans le relire.

### Phase 7 — Déploiement et livraison du lien

- **Objectif** : une URL publique accessible hors de la machine de développement.
- **Tâches** : build de prod, déploiement (choix §4.2), test de l'URL publique **en navigation privée et sur téléphone**, vérification HTTPS (indispensable pour le partage), contrôle que la galerie fonctionne bien sur le domaine final (le stockage est lié à l'origine !).
- **Livrable** : une URL publique testée.
- **Done when** : l'URL ouverte depuis un autre appareil affiche l'app et permet de créer + retrouver un mème.

---

## 4. Décisions à trancher avant la Phase 1

| #   | Décision                     | Recommandation                                                                                | Pourquoi                                                                                                          |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 4.1 | Stockage                     | **LocalStorage + les 5 garde-fous du §1.8**                                                   | Simple, explicable, suffisant ; `storage.js` garde la porte ouverte à IndexedDB                                   |
| 4.2 | Déploiement                  | **Lien public hébergé direct (immédiat, sans compte)** ou **Vercel** (si compte GitHub dispo) | L'objectif est une URL publique ; Vercel ajoute une étape compte/repo mais donne une URL plus « professionnelle » |
| 4.3 | Langage                      | **JavaScript (JSX)**, pas TypeScript                                                          | Moins de concepts à expliquer, sujet déjà dense                                                                   |
| 4.4 | Ré-édition depuis la galerie | **Oui**                                                                                       | Quasi gratuit grâce aux métadonnées de texte, et valorisable en soutenance                                        |

---

## 5. Matrice de traçabilité & checklist de recette

| Exigence PDF                           | FR    | Phase | Test de recette                                                        |
| -------------------------------------- | ----- | ----- | ---------------------------------------------------------------------- |
| Téléchargement d'images                | FR-01 | P2    | Importer JPG, PNG, WebP → OK ; importer un `.pdf` → message d'erreur   |
| Ajout de texte                         | FR-02 | P3    | 2 blocs minimum, styles différents, texte long ne déborde pas          |
| Aperçu en temps réel                   | FR-03 | P2/P3 | Frappe au clavier → canvas mis à jour immédiatement                    |
| Téléchargement et partage              | FR-04 | P4    | PNG valide + partage natif mobile + repli desktop                      |
| Galerie                                | FR-05 | P5    | 3 mèmes → F5 → toujours présents                                       |
| (Note du PDF) Propriété intellectuelle | §1.7  | P6    | README + footer : images fournies par l'utilisateur, aucun asset tiers |

**Checklist transverse** : responsive, navigation clavier, pas d'erreur console, aucun appel réseau métier, quota géré, build OK, URL testée hors de la machine.

---

## 6. Risques et mitigations

| Risque                                               | Impact                               | Mitigation                                                                                                     |
| ---------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Quota LocalStorage (~5 Mo) saturé                    | Galerie muette / plantage            | Compression 1280 px + JPEG 0,78, suivi du quota, message actionnable, éviction ou migration IndexedDB (P4-bis) |
| Partage social impossible sans backend               | Exigence PDF « partagée » incomplète | Web Share API + replis documentés, explication en soutenance (§1.6)                                            |
| Canvas « tainted » par une image distante            | Export impossible                    | Interdire les URL externes, uniquement des `File` locaux                                                       |
| L'utilisateur vide son cache                         | Perte des mèmes                      | Avertissement + export/import JSON (bonus P5)                                                                  |
| Stockage lié à l'origine (localhost ≠ domaine final) | Galerie « vide » après déploiement   | Tester sur l'URL finale en P7, ne pas promettre de migration localhost → prod                                  |
| Code trop « magique » à expliquer                    | Pénalité à l'oral                    | Peu de dépendances, `drawMeme` pure, `storage.js` isolé, README FAQ                                            |
| Note de propriété intellectuelle du sujet            | Conformité                           | Aucun template/image tiers embarqué, crédit du sujet, mention dans le README                                   |


---

## 7. Règle de fonctionnement

On avance **phase par phase**, dans l'ordre. À la fin de chaque phase : démo courte + validation, puis on passe à la suivante. Toute modification du périmètre (ajout d'une fonctionnalité, changement de stack) est d'abord notée ici avant d'être codée.

### Journal des décisions

| Date       | Changement                                                                                                                                                                                                                   | Raison                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13/11/2026 | v1.0 — rédaction du PRD et des 8 phases                                                                                                                                                                                      | Cadrage demandé avant tout code                                                                                                                         |
| 13/11/2026 | v1.1 — stockage du **fond + calques** au lieu du mème aplati ; `fontSize` relatif ; miniatures générées à la volée                                                                                                           | Éviter le texte dupliqué à la ré-édition, garder une seule fonction de rendu, économiser le quota                                                       |
| 13/11/2026 | Décisions §4 validées par défaut au démarrage : **LocalStorage + garde-fous**, **JavaScript**, **ré-édition = oui**, **déploiement = lien public hébergé direct**                                                            | L'utilisateur a demandé de démarrer sans attendre                                                                                                       |
| 13/11/2026 | v1.2 — refonte UI/UX : thème clair sobre, copy au vouvoiement, suppression des emojis et effets décoratifs, image d'exemple neutre, commentaires allégés (charte §1.10)                                                      | Demande d'une interface simple, moderne et professionnelle                                                                                              |
| 13/11/2026 | v1.3 — simplification de l'en-tête et du titre de l'onglet                                                                                                                                                                   | Demande de l'utilisateur : information inutile dans l'interface                                                                                         |
| 13/11/2026 | v1.4 — ajout de commentaires au format Google docstring (`Args` / `Returns` / `Raises` / `Props` / `Notes`) dans `src/` et d'un parcours de relecture dans le README §3 ; harmonisation des messages de quota au vouvoiement | L'utilisateur veut pouvoir relire et expliquer le code après une longue interruption                                                                    |
| 14/11/2026 | v1.5 — déploiement Vercel réalisé par l'utilisateur : URL publique renseignée ; recette effectuée sur le domaine public (HTTPS, canvas, LocalStorage, persistance après rechargement, 0 erreur console)                      | Le suffixe `-rouge` est ajouté par Vercel car `generateur-de-memes.vercel.app` appartient à un autre compte ; le nom court n'est donc pas revendiquable |
| 14/11/2026 | v1.6 — retrait des sections de contexte externe et des mentions nominatives dans les documents ; PRD, phases, checklist et recette conservés                                                                                 | Demande de l'utilisateur : recentrer le cadrage sur le produit                                                                                          |

### Avancement

| Phase               | Statut  | Résultat                                                                                         |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| P0 Cadrage          | Terminé | SPEC.md v1.1, décisions actées                                                                   |
| P1 Socle            | Terminé | Vite + React (JSX), 2 vues, CSS responsive                                                       |
| P2 Import + Canvas  | Terminé | FR-01 / FR-03, `drawMeme` unique, drag des textes                                                |
| P3 Texte            | Terminé | FR-02, blocs illimités + styles                                                                  |
| P4 Export / partage | Terminé | FR-04, PNG/JPG, Web Share + 3 replis                                                             |
| P5 Galerie          | Terminé | FR-05, persistance, quota, export/import JSON, ré-édition fidèle                                 |
| P6 Finition         | Terminé | README, accessibilité, `npm run build` OK, recette navigateur réussie                            |
| P7 Déploiement      | Terminé | URL publique Vercel en HTTPS, assets JS/CSS servis en 200, galerie vérifiée sur le domaine final |
