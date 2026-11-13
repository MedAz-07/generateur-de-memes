/**
 * Point d'entrée de l'application.
 *
 * Rôle dans le projet : monter le composant App dans la div `#root` de
 * index.html et charger la feuille de style unique. React.StrictMode active
 * les avertissements de développement ; il est sans effet sur le build final.
 *
 * Ordre de démarrage : index.html -> main.jsx -> App.jsx -> composants / lib.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
