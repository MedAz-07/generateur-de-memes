/**
 * Composant racine : état de l'application et orchestration des deux vues.
 *
 * Carte du fichier, dans l'ordre de lecture conseillé après une longue pause :
 *   1. createTextBlock / defaultTexts / makeTitle : forme des données.
 *   2. App() : tous les états (vue, mème courant, galerie, notifications).
 *   3. handleFile, handleSample, patchText, addText, removeText : construire le mème.
 *   4. handleSave, handleEdit, handleDownload, handleShare : enregistrer et sortir.
 *   5. performDelete, requestDelete, handleExport, handleImport : gérer la galerie.
 *   6. Le JSX final : en-tête, éditeur ou galerie, modales, notification.
 *
 * Point important à retenir : `meme.background` est un HTMLImageElement (non
 * sérialisable) alors que la galerie stocke un DataURL. La conversion se fait
 * dans handleSave() avec canvasToDataUrl(), et dans le sens inverse dans
 * handleEdit() avec loadImage().
 *
 * Dépendances : les composants de src/components et les modules de src/lib.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Dropzone from './components/Dropzone.jsx';
import MemeCanvas from './components/MemeCanvas.jsx';
import TextControls from './components/TextControls.jsx';
import Toolbar from './components/Toolbar.jsx';
import Gallery from './components/Gallery.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ShareDialog from './components/ShareDialog.jsx';
import { makeId } from './lib/id.js';
import {
  readImageFile,
  loadImage,
  canvasToDataUrl,
  fitDimensions,
  makeSampleImage,
} from './lib/image.js';
import {
  loadGallery,
  saveGallery,
  usageRatio,
  downloadGalleryJson,
  parseGalleryJson,
  QUOTA_WARN_RATIO,
} from './lib/storage.js';
import { downloadMeme, shareMeme } from './lib/share.js';

/**
 * Crée un bloc de texte avec les réglages par défaut de l'éditeur.
 *
 * Args:
 *   content (string): Texte initial.
 *   y (number): Position verticale relative, 0 en haut et 1 en bas.
 *   extra (object, optional): Champs à surcharger (style, position…).
 *
 * Returns:
 *   object: Bloc complet, avec un identifiant unique.
 *
 * Notes:
 *   fontSize est une fraction de la largeur du mème et strokeWidth une
 *   fraction de la taille de police : le rendu reste proportionnel.
 */
function createTextBlock(content, y, extra = {}) {
  return {
    id: makeId('t'),
    content,
    x: 0.5,
    y,
    fontSize: 0.075,
    fontFamily: 'Impact',
    color: '#FFFFFF',
    strokeColor: '#101018',
    strokeWidth: 0.08,
    bold: true,
    uppercase: true,
    align: 'center',
    ...extra,
  };
}

/**
 * Construit les deux blocs affichés au chargement d'une nouvelle image.
 *
 * Args:
 *   Aucun.
 *
 * Returns:
 *   object[]: Un bloc en haut (y = 0.12) et un bloc en bas (y = 0.86).
 */
function defaultTexts() {
  return [
    createTextBlock('QUAND TU CROIS QUE', 0.12),
    createTextBlock('C EST BON', 0.86),
  ];
}

/**
 * Dérive le titre d'un mème à partir de ses deux premiers textes.
 *
 * Args:
 *   texts (object[]): Blocs de texte du mème courant.
 *
 * Returns:
 *   string: Titre tronqué à 48 caractères, ou 'Mème sans texte'.
 */
function makeTitle(texts) {
  const parts = texts.map((text) => String(text.content || '').trim()).filter(Boolean);
  if (!parts.length) return 'Mème sans texte';
  return parts.slice(0, 2).join(' / ').slice(0, 48);
}

/**
 * Composant racine de l'application.
 *
 * Props:
 *   Aucune : monté directement par main.jsx.
 *
 * État local :
 *   view ('editor' | 'gallery') : vue affichée ;
 *   meme (object|null) : mème en cours, background = HTMLImageElement ;
 *   selectedId (string|null) : bloc de texte sélectionné ;
 *   gallery (object) : contenu persistant de la clé `meme-gallery:v1` ;
 *   toast, error, saving, shareOpen, confirm : états d'interface.
 *
 * Returns:
 *   JSX.Element: En-tête, éditeur ou galerie, modales et notification.
 *
 * Notes:
 *   Pas de routeur : deux vues seulement, pilotées par `view`. La galerie est
 *   lue une fois au montage grâce à `useState(loadGallery)`.
 */
export default function App() {
  const [view, setView] = useState('editor');
  const [meme, setMeme] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [gallery, setGallery] = useState(loadGallery);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  /**
   * Affiche une notification temporaire en bas de l'écran.
   *
   * Args:
   *   message (string): Texte à afficher.
   *   type (string, optional): 'success', 'error' ou 'warn'. 'success' par défaut.
   *
   * Notes:
   *   L'identifiant aléatoire force le remontage du composant, donc le
   *   redémarrage du minuteur, même pour deux messages identiques.
   */
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() + Math.random() });
  }, []);

  // La notification disparaît après 4,2 s ; le nettoyage évite les minuteurs
  // accumulés si plusieurs messages se succèdent.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const usage = usageRatio(gallery);

  /**
   * Charge un fichier choisi et ouvre un nouveau mème dans l'éditeur.
   *
   * Args:
   *   file (File): Image locale à valider et décoder.
   *
   * Notes:
   *   En cas d'erreur, le message est affiché dans l'alerte et en notification.
   *   `editingId` est remis à null : il s'agit bien d'un nouveau mème.
   */
  async function handleFile(file) {
    setError('');
    try {
      const result = await readImageFile(file);
      const dims = fitDimensions(result.width, result.height);
      setMeme({
        width: dims.width,
        height: dims.height,
        background: result.image,
        sourceName: result.name,
        title: '',
        texts: defaultTexts(),
        editingId: null,
      });
      setSelectedId(null);
      notify('Image importée. Vous pouvez modifier le texte.');
    } catch (problem) {
      setError(problem.message);
      notify(problem.message, 'error');
    }
  }

  /**
   * Charge l'image d'exemple générée localement.
   *
   * Args:
   *   Aucun.
   *
   * Notes:
   *   Même structure d'état que handleFile(), avec un fond 1200 × 800 créé par
   *   makeSampleImage(). Permet d'essayer l'application sans fichier.
   */
  async function handleSample() {
    setError('');
    try {
      const image = await loadImage(makeSampleImage());
      setMeme({
        width: 1200,
        height: 800,
        background: image,
        sourceName: 'exemple-local.jpg',
        title: '',
        texts: defaultTexts(),
        editingId: null,
      });
      setSelectedId(null);
      notify('Image d’exemple chargée.');
    } catch (problem) {
      notify(problem.message, 'error');
    }
  }

  /**
   * Met à jour un bloc de texte sans toucher aux autres.
   *
   * Args:
   *   id (string): Identifiant du bloc à modifier.
   *   patch (object): Champs à remplacer (contenu, style ou position).
   *
   * Notes:
   *   Chaque frappe passe par ici : c'est ce qui déclenche le redessin du
   *   canvas en temps réel dans MemeCanvas.
   */
  function patchText(id, patch) {
    setMeme((previous) =>
      previous
        ? { ...previous, texts: previous.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)) }
        : previous,
    );
  }

  /**
   * Ajoute un bloc de texte centré et le sélectionne.
   *
   * Args:
   *   Aucun.
   */
  function addText() {
    if (!meme) return;
    const text = createTextBlock('NOUVEAU TEXTE', 0.5);
    setMeme({ ...meme, texts: [...meme.texts, text] });
    setSelectedId(text.id);
  }

  /**
   * Supprime un bloc de texte.
   *
   * Args:
   *   id (string): Identifiant du bloc à retirer.
   *
   * Notes:
   *   Si le bloc supprimé était sélectionné, la sélection est effacée.
   */
  function removeText(id) {
    if (!meme) return;
    setMeme({ ...meme, texts: meme.texts.filter((text) => text.id !== id) });
    if (selectedId === id) setSelectedId(null);
  }

  /**
   * Vide l'éditeur pour repartir d'une page blanche.
   *
   * Args:
   *   Aucun.
   *
   * Notes:
   *   Ne touche pas à la galerie : les mèmes déjà enregistrés restent intacts.
   */
  function resetEditor() {
    setMeme(null);
    setSelectedId(null);
    setError('');
    notify('Éditeur réinitialisé.');
  }

  /**
   * Enregistre le mème courant dans la galerie persistante.
   *
   * Args:
   *   Aucun (utilise l'état `meme` et `gallery`).
   *
   * Notes:
   *   Le fond est compressé en DataURL, les textes restent des calques JSON.
   *   Si `meme.editingId` existe, l'entrée correspondante est remplacée au
   *   lieu d'être dupliquée. Les erreurs de quota sont transformées en
   *   notification par storage.js.
   */
  async function handleSave() {
    if (!meme || saving) return;
    setSaving(true);
    try {
      const dims = fitDimensions(meme.width, meme.height);
      const background = canvasToDataUrl(meme.background, dims.width, dims.height);
      const entry = {
        id: meme.editingId || makeId('m'),
        createdAt: new Date().toISOString(),
        title: makeTitle(meme.texts),
        width: dims.width,
        height: dims.height,
        background,
        bytes: background.length,
        texts: meme.texts.map((text) => ({ ...text })),
      };
      const next = {
        version: gallery.version,
        memes: [entry, ...gallery.memes.filter((item) => item.id !== entry.id)],
      };
      saveGallery(next);
      setGallery(next);
      setMeme((previous) => (previous ? { ...previous, editingId: entry.id, title: entry.title } : previous));
      const wasEditing = Boolean(meme.editingId);
      const quotaWarning = usageRatio(next) >= QUOTA_WARN_RATIO
        ? ' Le stockage approche de sa limite : exportez la galerie au format JSON.'
        : '';
      notify(`${wasEditing ? 'Mème mis à jour' : 'Mème enregistré'} dans la galerie.${quotaWarning}`);
    } catch (problem) {
      notify(problem.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Rouvre un mème de la galerie dans l'éditeur.
   *
   * Args:
   *   entry (object): Entrée de galerie, avec un `background` en DataURL.
   *
   * Notes:
   *   Le DataURL est reconverti en HTMLImageElement par loadImage(). Les
   *   calques de texte sont recopiés pour ne pas modifier l'entrée stockée.
   */
  async function handleEdit(entry) {
    try {
      const image = await loadImage(entry.background);
      setMeme({
        width: entry.width,
        height: entry.height,
        background: image,
        sourceName: entry.title,
        title: entry.title,
        texts: entry.texts.map((text) => ({ ...text })),
        editingId: entry.id,
      });
      setSelectedId(null);
      setError('');
      setView('editor');
      notify('Mème chargé dans l’éditeur.');
    } catch (problem) {
      notify(problem.message, 'error');
    }
  }

  /**
   * Télécharge un mème au format choisi.
   *
   * Args:
   *   format (string, optional): 'png' ou 'jpg', 'png' par défaut.
   *   entry (object|null, optional): Entrée de galerie à exporter. Si elle est
   *     fournie, son DataURL est d'abord reconverti en image ; sinon on
   *     exporte le mème courant.
   *
   * Notes:
   *   La barre d'outils appelle cette fonction avec un format, la galerie avec
   *   une entrée : d'où la valeur par défaut `entry = null`.
   */
  async function handleDownload(format = 'png', entry = null) {
    try {
      const source = entry
        ? { ...entry, background: await loadImage(entry.background) }
        : meme;
      if (!source) return;
      await downloadMeme(source, format);
      notify('Téléchargement lancé.');
    } catch (problem) {
      notify(problem.message, 'error');
    }
  }

  /**
   * Déclenche le partage du mème courant.
   *
   * Args:
   *   Aucun.
   *
   * Notes:
   *   Si shareMeme() retourne 'unsupported', la modale ShareDialog est ouverte
   *   pour proposer les liens de repli et le téléchargement.
   */
  async function handleShare() {
    if (!meme) return;
    try {
      const status = await shareMeme(meme);
      if (status === 'shared') notify('Mème partagé.');
      else if (status === 'copied') notify('Image copiée dans le presse-papiers.');
      else if (status === 'unsupported') setShareOpen(true);
    } catch {
      setShareOpen(true);
    }
  }

  /**
   * Retire définitivement un mème de la galerie.
   *
   * Args:
   *   entry (object): Entrée à supprimer.
   *
   * Notes:
   *   Si ce mème est ouvert dans l'éditeur, son `editingId` est effacé pour
   *   qu'un prochain enregistrement crée une nouvelle entrée.
   */
  function performDelete(entry) {
    const next = { version: gallery.version, memes: gallery.memes.filter((item) => item.id !== entry.id) };
    try {
      saveGallery(next);
      setGallery(next);
      if (meme && meme.editingId === entry.id) {
        setMeme((previous) => (previous ? { ...previous, editingId: null } : previous));
      }
      notify('Mème supprimé de la galerie.');
    } catch (problem) {
      notify(problem.message, 'error');
    }
  }

  /**
   * Prépare la boîte de confirmation avant une suppression.
   *
   * Args:
   *   entry (object): Mème concerné.
   *
   * Notes:
   *   L'action réelle est stockée dans l'objet `confirm` et exécutée par le
   *   bouton « Supprimer » de ConfirmDialog.
   */
  function requestDelete(entry) {
    setConfirm({
      title: 'Supprimer ce mème ?',
      message: `« ${entry.title} » sera retiré définitivement de la galerie de ce navigateur.`,
      confirmLabel: 'Supprimer',
      danger: true,
      action: () => performDelete(entry),
    });
  }

  /**
   * Télécharge la galerie entière au format JSON.
   *
   * Args:
   *   Aucun.
   */
  function handleExport() {
    downloadGalleryJson(gallery);
    notify('Galerie exportée en JSON.');
  }

  /**
   * Importe une galerie JSON après confirmation.
   *
   * Args:
   *   file (File): Fichier .json choisi par l'utilisateur.
   *
   * Notes:
   *   Les entrées importées sont fusionnées avec les mèmes déjà présents :
   *   un identifiant commun est remplacé, les autres sont conservés. Le tri
   *   final se fait par date décroissante.
   */
  async function handleImport(file) {
    try {
      const parsed = parseGalleryJson(await file.text());
      setConfirm({
        title: 'Importer cette galerie ?',
        message: `${parsed.memes.length} mème(s) vont être ajoutés. Les mèmes déjà présents sont conservés (doublons remplacés).`,
        confirmLabel: 'Importer',
        danger: false,
        action: () => {
          const byId = new Map(parsed.memes.map((item) => [item.id, item]));
          gallery.memes.forEach((item) => {
            if (!byId.has(item.id)) byId.set(item.id, item);
          });
          const merged = Array.from(byId.values()).sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          );
          const next = { version: gallery.version, memes: merged };
          try {
            saveGallery(next);
            setGallery(next);
            notify(`${parsed.memes.length} mème(s) importé(s).`);
          } catch (problem) {
            notify(problem.message, 'error');
          }
        },
      });
    } catch (problem) {
      notify(problem.message, 'error');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Générateur de mèmes</h1>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          <button
            type="button"
            className={view === 'editor' ? 'is-active' : ''}
            onClick={() => setView('editor')}
            aria-current={view === 'editor' ? 'page' : undefined}
          >
            Éditeur
          </button>
          <button
            type="button"
            className={view === 'gallery' ? 'is-active' : ''}
            onClick={() => setView('gallery')}
            aria-current={view === 'gallery' ? 'page' : undefined}
          >
            Galerie <span className="nav-count">({gallery.memes.length})</span>
          </button>
        </nav>
      </header>

      <main>
        {view === 'editor' ? (
          <>
            <div className="page-head">
              <h2>Éditeur</h2>
              <p>Importez une image, ajoutez du texte, puis enregistrez ou téléchargez le résultat.</p>
            </div>

            {error && <div className="alert" role="alert">{error}</div>}

            <div className="editor-grid">
              <div className="editor-side">
                <Dropzone onFile={handleFile} onSample={handleSample} currentName={meme && meme.sourceName} />
                <TextControls
                  texts={meme ? meme.texts : []}
                  selectedId={selectedId}
                  width={meme ? meme.width : 1000}
                  onSelect={setSelectedId}
                  onChange={patchText}
                  onAdd={addText}
                  onRemove={removeText}
                />
                <Toolbar
                  disabled={!meme}
                  saving={saving}
                  isEditing={Boolean(meme && meme.editingId)}
                  onSave={handleSave}
                  onDownload={handleDownload}
                  onShare={handleShare}
                  onReset={resetEditor}
                  onOpenGallery={() => setView('gallery')}
                />
              </div>

              <div className="editor-stage">
                <MemeCanvas
                  meme={meme}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMove={(id, x, y) => patchText(id, { x, y })}
                />
              </div>
            </div>
          </>
        ) : (
          <Gallery
            gallery={gallery}
            usage={usage}
            onEdit={handleEdit}
            onDownload={(entry) => handleDownload('png', entry)}
            onDelete={requestDelete}
            onExport={handleExport}
            onImport={handleImport}
            onOpenEditor={() => {
              resetEditor();
              setView('editor');
            }}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Les images sont traitées et conservées dans votre navigateur ; aucune donnée n’est envoyée sur un serveur.</p>
        <p>Visuels fournis par l’utilisateur ou générés localement — aucun élément tiers n’est utilisé.</p>
      </footer>

      <ConfirmDialog
        data={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm && confirm.action) confirm.action();
          setConfirm(null);
        }}
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onNotify={notify}
        onDownload={() => {
          handleDownload('png');
          setShareOpen(false);
        }}
      />

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" key={toast.id}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
