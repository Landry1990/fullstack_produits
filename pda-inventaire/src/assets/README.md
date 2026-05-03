# Assets Audio pour ScannerScreen

Ces fichiers audio sont utilisés pour le feedback sonore lors du scan de produits.

## Fichiers requis

| Fichier | Description | Durée suggérée |
|---------|-------------|----------------|
| `beep_success.wav` | Scan réussi, produit sauvegardé | ~100ms, ton aigu |
| `beep_error.wav` | Erreur (produit non trouvé, connexion) | ~300ms, 2 beeps graves |
| `beep_warning.wav` | Avertissement (quantité vide, lot expirant) | ~200ms, ton moyen |

## Sources gratuites recommandées

### Option 1: Générer en ligne
- [Online Tone Generator](https://www.szynalski.com/tone-generator/) - Enregistrer avec Audacity
- [Beep.js](https://github.com/jeromeetienne/beepjs) - Générer programmatically

### Option 2: Télécharger
- [Freesound.org](https://freesound.org) - Rechercher "beep", "success", "error"
- [Mixkit.co](https://mixkit.co/free-sound-effects/click/) - Sons gratuits

### Option 3: Créer avec ffmpeg
```bash
# Success (1000Hz, 100ms)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.1" beep_success.wav

# Error (300Hz, 300ms, 2 beeps)
ffmpeg -f lavfi -i "sine=frequency=300:duration=0.15, sine=frequency=300:duration=0.15" beep_error.wav

# Warning (600Hz, 200ms)
ffmpeg -f lavfi -i "sine=frequency=600:duration=0.2" beep_warning.wav
```

## Format recommandé
- **Format**: WAV ou MP3
- **Sample rate**: 44100 Hz
- **Channels**: Mono ou Stereo
- **Volume**: -6dB (éviter la distorsion)

## Fallback
Si les fichiers audio ne sont pas présents, l'application utilise les vibrations comme fallback.
