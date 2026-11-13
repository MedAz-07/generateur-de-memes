/**
 * Réglages des blocs de texte (exigence FR-02 du sujet).
 *
 * Rôle dans le projet : afficher un panneau par bloc et transmettre chaque
 * modification à App.patchText(). Aucun dessin n'est fait ici : le canvas se
 * met à jour parce que l'état `meme.texts` change dans App.jsx.
 *
 * Les valeurs de style sont relatives (fraction de la largeur pour fontSize,
 * fraction de la police pour strokeWidth) : voir drawMeme.js.
 *
 * Utilisé par : App.jsx.
 */

import React from 'react';
import { FONT_NAMES } from '../lib/drawMeme.js';

/**
 * Carte de réglage d'un seul bloc de texte.
 *
 * Props:
 *   text (object): Bloc affiché (contenu, style, position).
 *   index (number): Position du bloc dans la liste, sert au numéro affiché.
 *   selected (boolean): True si ce bloc est sélectionné dans l'éditeur.
 *   width (number): Largeur du mème, pour convertir fontSize en pixels.
 *   onSelect (function): (string) => sélectionne ce bloc.
 *   onChange (function): (string, object) => applique les champs modifiés.
 *   onRemove (function): (string) => supprime ce bloc.
 *
 * Returns:
 *   JSX.Element: Zone de saisie, champs de style et actions du bloc.
 *
 * Notes:
 *   `stopPropagation()` sur les boutons évite de déclencher le clic de la
 *   carte en plus de l'action du bouton.
 */
function TextCard({ text, index, selected, width, onSelect, onChange, onRemove }) {
  const px = Math.round((text.fontSize ?? 0.075) * width);
  const set = (patch) => onChange(text.id, patch);
  const stop = (event) => event.stopPropagation();
  const number = String(index + 1).padStart(2, '0');

  return (
    <article
      className={`text-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(text.id)}
    >
      <header className="text-card-head">
        <span className="text-card-index">Texte {number}</span>
        <button
          type="button"
          className="btn-icon danger"
          onClick={(event) => {
            stop(event);
            onRemove(text.id);
          }}
          aria-label={`Supprimer le texte ${number}`}
        >
          Supprimer
        </button>
      </header>

      <textarea
        className="text-input"
        rows={2}
        value={text.content}
        placeholder="Saisissez votre texte"
        aria-label={`Contenu du texte ${number}`}
        onChange={(event) => set({ content: event.target.value })}
      />

      <div className="control-grid">
        <div className="field">
          <span className="field-label">Police</span>
          <select
            aria-label={`Police du texte ${number}`}
            value={text.fontFamily}
            onChange={(event) => set({ fontFamily: event.target.value })}
          >
            {FONT_NAMES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Taille <em>{px} px</em></span>
          <input
            type="range"
            min="2"
            max="18"
            step="0.5"
            value={Math.round((text.fontSize ?? 0.075) * 100)}
            aria-label={`Taille du texte ${number}`}
            onChange={(event) => set({ fontSize: Number(event.target.value) / 100 })}
          />
        </div>

        <div className="field">
          <span className="field-label">Couleur du texte</span>
          <input
            className="color-input"
            type="color"
            value={text.color}
            aria-label={`Couleur du texte ${number}`}
            onChange={(event) => set({ color: event.target.value })}
          />
        </div>

        <div className="field">
          <span className="field-label">Couleur du contour</span>
          <input
            className="color-input"
            type="color"
            value={text.strokeColor}
            aria-label={`Couleur du contour ${number}`}
            onChange={(event) => set({ strokeColor: event.target.value })}
          />
        </div>

        <div className="field">
          <span className="field-label">Épaisseur <em>{Math.round((text.strokeWidth ?? 0.08) * 100)} %</em></span>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={Math.round((text.strokeWidth ?? 0.08) * 100)}
            aria-label={`Épaisseur du contour ${number}`}
            onChange={(event) => set({ strokeWidth: Number(event.target.value) / 100 })}
          />
        </div>

        <div className="field">
          <span className="field-label">Alignement</span>
          <select
            aria-label={`Alignement du texte ${number}`}
            value={text.align}
            onChange={(event) => set({ align: event.target.value })}
          >
            <option value="center">Centré</option>
            <option value="left">Gauche</option>
            <option value="right">Droite</option>
          </select>
        </div>
      </div>

      <footer className="text-card-toggles">
        <label className="toggle">
          <input
            type="checkbox"
            checked={text.bold !== false}
            onChange={(event) => set({ bold: event.target.checked })}
          />
          Gras
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={text.uppercase !== false}
            onChange={(event) => set({ uppercase: event.target.checked })}
          />
          Majuscules
        </label>
        <button
          type="button"
          className="btn btn-link btn-small"
          onClick={(event) => {
            stop(event);
            set({ x: 0.5, y: index === 0 ? 0.12 : 0.86 });
          }}
        >
          Recentrer
        </button>
      </footer>
    </article>
  );
}

/**
 * Liste des blocs de texte et bouton d'ajout.
 *
 * Props:
 *   texts (object[]): Blocs du mème courant (tableau vide si aucune image).
 *   selectedId (string|null): Bloc actuellement sélectionné.
 *   width (number): Largeur du mème, transmise à chaque carte.
 *   onSelect (function): (string|null) => sélection.
 *   onChange (function): (string, object) => modification d'un bloc.
 *   onAdd (function): () => ajoute un bloc centré.
 *   onRemove (function): (string) => supprime un bloc.
 *
 * Returns:
 *   JSX.Element: Panneau « Textes ».
 *
 * Notes:
 *   La sélection sert aussi au déplacement sur le canvas : cliquer sur une
 *   carte met en évidence le bloc correspondant.
 */
export default function TextControls({ texts, selectedId, width, onSelect, onChange, onAdd, onRemove }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Textes</h2>
          <p>Modifiez le contenu et le style de chaque bloc.</p>
        </div>
        <button type="button" className="btn btn-small" onClick={onAdd}>
          + Ajouter
        </button>
      </header>

      {texts.length === 0 && (
        <p className="muted">Aucun bloc de texte. Cliquez sur « Ajouter ».</p>
      )}

      <div className="text-list">
        {texts.map((text, index) => (
          <TextCard
            key={text.id}
            text={text}
            index={index}
            selected={text.id === selectedId}
            width={width}
            onSelect={onSelect}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}
