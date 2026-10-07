import { Dimensions, PixelRatio } from 'react-native';

// Mise à l'échelle proportionnelle à l'écran (équivalent léger de
// react-native-size-matters, sans dépendance).
//
// - Téléphone (petit côté ≤ ~420dp) : ×1 — taille nominale.
// - Petit PDA (~420-800dp, ex. 7" à ~605dp) : descend jusqu'à ×0.72 —
//   ces écrans affichaient les tailles téléphone qui restaient trop
//   grosses à l'usage (605dp ≈ ×0.76).
// - Tablette (> 800dp) : croissance proportionnelle jusqu'à ×1.5 à
//   ~900dp — le rendu 12" (validé) est inchangé.
//
// ⚠️ Calculé au chargement du module : un changement d'orientation
// après le lancement n'est pas repris (les StyleSheet sont statiques).

const { width, height } = Dimensions.get('window');
const shortSide = Math.min(width, height);
const ratio =
  shortSide <= 420
    ? 1
    : shortSide <= 800
      ? Math.max(shortSide / 800, 0.72) // 605dp ≈ ×0.76
      : Math.min(shortSide / 600, 1.5);

/** Échelle pleine : taille × ratio écran. */
export const scale = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel(size * ratio));

/** Échelle asymétrique : la RÉDUCTION est pleine (un petit écran a
 *  besoin du vrai rétrécissement) ; seule la CROISSANCE est atténuée
 *  (défaut 0.5) pour polices/paddings — évite des écarts trop brutaux
 *  sur grande tablette. */
export const moderateScale = (size: number, factor = 0.5) => {
  const scaled = size * ratio;
  const f = scaled < size ? 1 : factor;
  return Math.round(PixelRatio.roundToNearestPixel(size + (scaled - size) * f));
};
