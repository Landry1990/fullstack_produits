import { Dimensions, PixelRatio } from 'react-native';

// Mise à l'échelle proportionnelle à l'écran (équivalent léger de
// react-native-size-matters, sans dépendance).
//
// Référence : le petit côté d'un téléphone ≈ 375dp. Les éléments ne
// rétrécissent JAMAIS sous la référence (min ×1 — sur petit écran le
// clavier comprime déjà l'UI, réduire encore rend l'app illisible) ;
// au-dessus (tablettes) ils grossissent (×1.5 max).
//
// ⚠️ Calculé au chargement du module : un changement d'orientation
// après le lancement n'est pas repris (les StyleSheet sont statiques).

const guidelineWidth = 375;
const { width, height } = Dimensions.get('window');
const shortSide = Math.min(width, height);
const ratio = Math.min(Math.max(shortSide / guidelineWidth, 1), 1.5);

/** Échelle pleine : taille × ratio écran. */
export const scale = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel(size * ratio));

/** Échelle atténuée (défaut 0.5) : croissance progressive, recommandée
 *  pour polices/paddings afin d'éviter des écarts trop brutaux. */
export const moderateScale = (size: number, factor = 0.5) =>
  Math.round(PixelRatio.roundToNearestPixel(size + (size * ratio - size) * factor));
