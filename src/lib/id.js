/**
 * Génération d'identifiants locaux.
 *
 * Rôle dans le projet : fournir une clé unique pour un mème (`m_…`) ou un
 * bloc de texte (`t_…`). Aucune base de données n'est impliquée : ces clés ne
 * servent qu'à distinguer les éléments dans le tableau de la galerie et dans
 * l'état React.
 *
 * Utilisé par : App.jsx.
 */

/**
 * Construit un identifiant court à partir de l'heure et d'un nombre aléatoire.
 *
 * Args:
 *   prefix (string, optional): Préfixe logique, 'm' pour un mème, 't' pour un texte.
 *     Valeur par défaut : 'm'.
 *
 * Returns:
 *   string: Identifiant de la forme `prefix_horodatage_base36_alea_base36`.
 *
 * Notes:
 *   Suffisant pour une galerie locale, mais pas conçu comme identifiant
 *   universel (pas de garantie contre les collisions à très grande échelle).
 */
export function makeId(prefix = 'm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
