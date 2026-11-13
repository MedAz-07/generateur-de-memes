/**
 * Boîte de confirmation générique.
 *
 * Rôle dans le projet : demander une validation avant une suppression ou un
 * import JSON. L'action à exécuter n'est pas codée ici : elle est fournie
 * dans `data.action` par App.jsx.
 *
 * Utilisé par : App.jsx.
 */

import React, { useEffect } from 'react';

/**
 * Affiche une modale de confirmation, ou rien si aucune demande n'est en cours.
 *
 * Props:
 *   data (object|null): Description de la demande :
 *     title, message, confirmLabel, danger (boolean), action (function).
 *   onCancel (function): () => ferme sans rien faire.
 *   onConfirm (function): () => exécute `data.action` puis ferme.
 *
 * Returns:
 *   JSX.Element|null: La modale, ou null.
 *
 * Notes:
 *   La touche Échap et un clic sur le fond ferment la modale sans exécuter
 *   l'action.
 */
export default function ConfirmDialog({ data, onCancel, onConfirm }) {
  useEffect(() => {
    if (!data) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, onCancel]);

  if (!data) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal modal-small" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{data.title}</h2>
        <p>{data.message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            type="button"
            className={`btn ${data.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {data.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
