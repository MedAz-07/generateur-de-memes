/**
 * Modale de repli du partage.
 *
 * Rôle dans le projet : prendre le relais quand le navigateur ne propose ni
 * Web Share avec fichier ni copie d'image dans le presse-papiers. Elle
 * propose alors les liens de partage de l'adresse du site et le
 * téléchargement de l'image, que l'utilisateur publie lui-même.
 *
 * Rappel : sans backend, publier directement sur un compte de réseau social
 * est impossible. Cette limite est expliquée dans le README.
 *
 * Utilisé par : App.jsx.
 */

import React, { useEffect } from 'react';
import { socialLinks, copySiteLink } from '../lib/share.js';

/**
 * Affiche les solutions de repli, ou rien si la modale est fermée.
 *
 * Props:
 *   open (boolean): True pour afficher la modale.
 *   onClose (function): () => ferme la modale.
 *   onDownload (function): () => télécharge le mème en PNG et ferme la modale.
 *   onNotify (function): (string, string) => affiche une notification.
 *
 * Returns:
 *   JSX.Element|null: La modale, ou null.
 *
 * Notes:
 *   La touche Échap et un clic sur le fond ferment la modale. Les liens
 *   externes utilisent `rel="noopener noreferrer"`.
 */
export default function ShareDialog({ open, onClose, onDownload, onNotify }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  /**
   * Copie l'adresse du site et confirme le résultat par une notification.
   *
   * Args:
   *   Aucun.
   *
   * Returns:
   *   Promise<void>.
   */
  async function handleCopy() {
    const ok = await copySiteLink();
    onNotify(ok ? 'Lien du site copié.' : 'Copie refusée par le navigateur.', ok ? 'success' : 'error');
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Partager</h2>
        <p>
          Ce navigateur ne propose pas le partage d’image natif. Vous pouvez partager l’adresse du site,
          ou télécharger l’image et la publier vous-même.
        </p>

        <div className="share-links">
          {socialLinks().map((link) => (
            <a key={link.label} className="btn btn-small" href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={handleCopy}>Copier le lien</button>
          <button type="button" className="btn btn-primary" onClick={onDownload}>Télécharger l’image</button>
          <button type="button" className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
