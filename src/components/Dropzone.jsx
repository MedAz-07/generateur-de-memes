/**
 * Zone d'import d'image (exigence FR-01 du sujet).
 *
 * Rôle dans le projet : proposer les deux moyens d'importer un fichier local,
 * le sélecteur et le glisser-déposer. La validation réelle du type et de la
 * taille est déléguée à image.js via App.handleFile().
 *
 * Utilisé par : App.jsx.
 */

import React, { useRef, useState } from 'react';
import { ALLOWED_TYPES } from '../lib/image.js';

/**
 * Affiche la zone d'import et remonte le fichier choisi.
 *
 * Props:
 *   onFile (function): (File) => traite le fichier sélectionné ou déposé.
 *   onSample (function): () => charge l'image d'exemple générée localement.
 *   currentName (string|null): Nom du fichier courant, affiché sous la zone et
 *     utilisé pour libeller le bouton « Changer de fichier ».
 *
 * Returns:
 *   JSX.Element: Un panneau « Image » contenant la zone de dépôt.
 *
 * Notes:
 *   `event.target.value = ''` après la sélection permet de choisir deux fois
 *   de suite le même fichier.
 */
export default function Dropzone({ onFile, onSample, currentName }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  /**
   * Récupère le premier fichier déposé et le transmet à App.
   *
   * Args:
   *   event (DragEvent): Événement de dépôt.
   */
  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  /**
   * Transmet le fichier choisi via le sélecteur, puis réinitialise l'input.
   *
   * Args:
   *   event (Event): Événement `change` de l'input de type file.
   */
  function handleChange(event) {
    const file = event.target.files && event.target.files[0];
    if (file) onFile(file);
    event.target.value = '';
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Image</h2>
      </header>

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="sr-only"
          onChange={handleChange}
          aria-label="Choisir une image sur votre appareil"
        />
        <p className="dropzone-title">Déposez une image ici</p>
        <p className="dropzone-hint">JPG, PNG ou WebP — 10 Mo maximum.</p>
        <div className="dropzone-actions">
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current && inputRef.current.click()}>
            {currentName ? 'Changer de fichier' : 'Choisir un fichier'}
          </button>
          <button type="button" className="btn btn-link" onClick={onSample}>
            Utiliser l’image d’exemple
          </button>
        </div>
        {currentName && <p className="dropzone-file" title={currentName}>Fichier : {currentName}</p>}
      </div>
    </section>
  );
}
