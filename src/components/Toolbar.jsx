/**
 * Actions finales : enregistrement, téléchargement et partage (exigence FR-04).
 *
 * Rôle dans le projet : regrouper les boutons de sortie du mème. Ce composant
 * ne traite rien lui-même : il appelle les gestionnaires fournis par App.jsx.
 * Le format de téléchargement est le seul état local (PNG ou JPG).
 *
 * Utilisé par : App.jsx.
 */

import React, { useState } from 'react';

/**
 * Affiche les actions disponibles pour le mème courant.
 *
 * Props:
 *   disabled (boolean): True si aucune image n'est chargée.
 *   saving (boolean): True pendant l'écriture en galerie.
 *   isEditing (boolean): True si le mème provient de la galerie ; le bouton
 *     principal devient alors « Mettre à jour ».
 *   onSave (function): () => enregistre dans la galerie.
 *   onDownload (function): (string) => exporte au format 'png' ou 'jpg'.
 *   onShare (function): () => lance le partage.
 *   onReset (function): () => vide l'éditeur.
 *   onOpenGallery (function): () => bascule vers la vue Galerie.
 *
 * Returns:
 *   JSX.Element: Panneau « Actions ».
 */
export default function Toolbar({
  disabled,
  saving,
  isEditing,
  onSave,
  onDownload,
  onShare,
  onReset,
  onOpenGallery,
}) {
  const [format, setFormat] = useState('png');

  return (
    <section className="panel toolbar">
      <header className="panel-head">
        <div>
          <h2>Actions</h2>
          <p>Enregistrez, téléchargez ou partagez le résultat.</p>
        </div>
      </header>

      <div className="toolbar-actions">
        <button type="button" className="btn btn-primary" disabled={disabled || saving} onClick={onSave}>
          {saving ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Enregistrer dans la galerie'}
        </button>

        <div className="toolbar-row">
          <select
            className="format-select"
            value={format}
            aria-label="Format de téléchargement"
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => onDownload(format)}
          >
            Télécharger
          </button>
          <button type="button" className="btn" disabled={disabled} onClick={onShare}>
            Partager
          </button>
        </div>

        <div className="toolbar-links">
          <button type="button" className="btn btn-link btn-small" onClick={onOpenGallery}>
            Voir la galerie
          </button>
          <button type="button" className="btn btn-link btn-small" disabled={disabled} onClick={onReset}>
            Réinitialiser l’éditeur
          </button>
        </div>
      </div>

      <p className="toolbar-note">
        Le partage utilise le menu natif de l’appareil lorsqu’il est disponible.
      </p>
    </section>
  );
}
