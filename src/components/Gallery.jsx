/**
 * Vue Galerie (exigence FR-05 du sujet).
 *
 * Rôle dans le projet : lister les mèmes enregistrés, proposer un aperçu grand
 * format, la modification, le téléchargement, la suppression, l'export et
 * l'import JSON. La barre de quota affiche l'espace occupé dans le
 * LocalStorage et prévient à partir de 80 %.
 *
 * Ce composant ne écrit jamais directement dans le stockage : toutes les
 * opérations passent par les gestionnaires fournis par App.jsx, qui appellent
 * storage.js.
 *
 * Utilisé par : App.jsx.
 */

import React, { useEffect, useRef, useState } from 'react';
import MemeThumbnail from './MemeThumbnail.jsx';
import { usageLabel } from '../lib/storage.js';

/**
 * Formate une date ISO pour l'affichage sous une carte.
 *
 * Args:
 *   iso (string): Date au format ISO 8601 (`createdAt`).
 *
 * Returns:
 *   string: Date lisible en français, ou 'date inconnue' si le parsing échoue.
 */
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'date inconnue';
  }
}

/**
 * Carte d'un mème enregistré.
 *
 * Props:
 *   meme (object): Entrée de galerie (titre, date, dimensions, fond, textes).
 *   onEdit (function): (object) => rouvre le mème dans l'éditeur.
 *   onDownload (function): (object) => télécharge ce mème en PNG.
 *   onDelete (function): (object) => demande confirmation avant suppression.
 *   onView (function): (object) => ouvre l'aperçu grand format.
 *
 * Returns:
 *   JSX.Element: Miniature, titre, date et actions.
 *
 * Notes:
 *   La miniature est produite par MemeThumbnail, qui redessine à partir du
 *   fond et des calques ; aucune image supplémentaire n'est stockée.
 */
function MemeCard({ meme, onEdit, onDownload, onDelete, onView }) {
  return (
    <article className="meme-card">
      <button
        type="button"
        className="meme-card-preview"
        onClick={() => onView(meme)}
        aria-label={`Agrandir le mème ${meme.title}`}
      >
        <MemeThumbnail meme={meme} scale={0.36} />
      </button>
      <div className="meme-card-body">
        <h3 title={meme.title}>{meme.title}</h3>
        <p>{formatDate(meme.createdAt)} · {meme.width}×{meme.height}</p>
        <div className="meme-card-actions">
          <button type="button" className="btn btn-small" onClick={() => onEdit(meme)}>Modifier</button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onDownload(meme)}
            aria-label={`Télécharger ${meme.title}`}
          >
            Télécharger
          </button>
        </div>
        <button
          type="button"
          className="btn btn-link btn-small card-delete"
          onClick={() => onDelete(meme)}
          aria-label={`Supprimer ${meme.title}`}
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}

/**
 * Affiche la galerie, la barre de quota et la modale d'aperçu.
 *
 * Props:
 *   gallery (object): { version, memes } chargé depuis le LocalStorage.
 *   usage (number): Part du quota utilisée, entre 0 et 1.
 *   onEdit (function): (object) => modifier un mème.
 *   onDownload (function): (object) => télécharger un mème.
 *   onDelete (function): (object) => demander une suppression.
 *   onExport (function): () => exporter la galerie en JSON.
 *   onImport (function): (File) => importer un fichier JSON.
 *   onOpenEditor (function): () => repartir sur un nouveau mème.
 *
 * Returns:
 *   JSX.Element: En-tête, quota, grille (ou état vide) et modale éventuelle.
 *
 * Notes:
 *   L'input de fichier JSON est masqué (classe `sr-only`) et déclenché par le
 *   bouton « Importer (JSON) » via une ref.
 */
export default function Gallery({
  gallery,
  usage,
  onEdit,
  onDownload,
  onDelete,
  onExport,
  onImport,
  onOpenEditor,
}) {
  const importRef = useRef(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    if (!viewer) return undefined;
    const onKey = (event) => event.key === 'Escape' && setViewer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  const memes = gallery.memes;
  const percent = Math.round(usage * 100);

  return (
    <div className="gallery-view">
      <header className="gallery-head">
        <div>
          <h1>Galerie <span>({memes.length})</span></h1>
          <p>Les mèmes sont conservés dans ce navigateur et restent après un rechargement de la page.</p>
        </div>
        <div className="gallery-head-actions">
          <button type="button" className="btn btn-small" onClick={onExport} disabled={!memes.length}>
            Exporter (JSON)
          </button>
          <button type="button" className="btn btn-small" onClick={() => importRef.current && importRef.current.click()}>
            Importer (JSON)
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={onOpenEditor}>
            Nouveau mème
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Importer une galerie au format JSON"
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              if (file) onImport(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <section className={`quota${usage >= 0.8 ? ' is-warning' : ''}`} aria-label="Espace de stockage utilisé">
        <div className="quota-top">
          <span>Stockage local</span>
          <strong>{usageLabel(gallery)} ({percent} %)</strong>
        </div>
        <div className="quota-track"><div className="quota-fill" style={{ width: `${Math.max(2, percent)}%` }} /></div>
        <p>
          {usage >= 0.8
            ? 'Espace presque saturé : supprimez un mème ou exportez la galerie au format JSON.'
            : 'Les données sont liées à ce navigateur ; l’export JSON permet de les conserver.'}
        </p>
      </section>

      {memes.length === 0 ? (
        <div className="gallery-empty">
          <h2>Aucun mème enregistré</h2>
          <p>Créez un mème, enregistrez-le, puis retrouvez-le ici après un rechargement de la page.</p>
          <button type="button" className="btn btn-primary" onClick={onOpenEditor}>Créer un mème</button>
        </div>
      ) : (
        <div className="meme-grid">
          {memes.map((meme) => (
            <MemeCard
              key={meme.id}
              meme={meme}
              onEdit={onEdit}
              onDownload={onDownload}
              onDelete={onDelete}
              onView={setViewer}
            />
          ))}
        </div>
      )}

      {viewer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setViewer(null)}>
          <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label={`Aperçu de ${viewer.title}`}>
            <h2>{viewer.title}</h2>
            <MemeThumbnail meme={viewer} scale={0.9} className="viewer-canvas" />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => onEdit(viewer)}>Modifier</button>
              <button type="button" className="btn btn-primary" onClick={() => onDownload(viewer)}>Télécharger</button>
              <button type="button" className="btn" onClick={() => setViewer(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
