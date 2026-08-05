"""
Compilation Cython des fichiers Python critiques en extensions binaires .so.

Exécuté dans le Dockerfile lors du build de l'image Docker de production.
Transforme chaque fichier .py listé ci-dessous en :
    1. .c   (source C générée par Cython)
    2. .so  (extension binaire compilée par gcc)
puis supprime le .py source et le .c intermédiaire.

Le client reçoit uniquement les .so — illisibles et impossibles à modifier.

⚠️  Ce script NE DOIT PAS être exécuté en développement :
    - Le volume ./backend:/app de docker-compose.yml remet les .py à chaque démarrage.
    - En dev, on garde les .py pour pouvoir développer et déboguer normalement.

Fichiers protégés (cf. AGENTS.md) :
    - backend/settings.py            -> backend/backend/settings.*.so
    - api/middleware_licence.py      -> backend/api/middleware_licence.*.so
    - api/utils_licence.py           -> backend/api/utils_licence.*.so
    - api/views/licence.py           -> backend/api/views/licence.*.so
    - api/keyday.py                  -> backend/api/keyday.*.so
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Racine du projet Django (= /app dans le container Docker)
BASE_DIR = Path(__file__).resolve().parent

# Liste des fichiers à compiler (relatifs à BASE_DIR).
# L'ordre n'a pas d'importance : Cython compile chaque fichier indépendamment.
PROTECTED_FILES = [
    "backend/settings.py",          # backend/backend/settings.py
    "api/middleware_licence.py",
    "api/utils_licence.py",
    "api/views/licence.py",
    "api/keyday.py",
]


def run(cmd, cwd=None):
    """Exécute une commande et lève une exception si elle échoue."""
    print(f"[compile] $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Commande échouée (code {result.returncode}): {' '.join(cmd)}"
        )
    return result


def compile_one(py_path: Path) -> None:
    """
    Compile un fichier .py en extension binaire .so via Cython + gcc.

    Étapes :
        1. cythonize --3x fichier.py  -> génère fichier.c
        2. gcc -shared ... fichier.c  -> génère fichier.cpython-XXX.so
        3. suppression du .py source et du .c intermédiaire
    """
    if not py_path.exists():
        print(f"[compile] ⚠️  Fichier introuvable, ignoré : {py_path}")
        return

    print(f"\n[compile] === {py_path.relative_to(BASE_DIR)} ===")

    # 1. Cython : .py -> .c
    #    --3x force Python 3 syntax
    run([sys.executable, "-m", "Cython.Build.Cythonize", "--3x", str(py_path)])

    c_file = py_path.with_suffix(".c")
    if not c_file.exists():
        raise RuntimeError(f"Cython n'a pas généré {c_file}")

    # 2. gcc : .c -> .so
    #    On utilise les mêmes flags que distutils/pip pour une extension Python.
    #    python3-config --includes donne les headers Python nécessaires.
    include_flags = subprocess.check_output(
        [sys.executable, "-c",
         "import sysconfig; print(' '.join('-I' + p for p in "
         "[sysconfig.get_path('include'), sysconfig.get_path('platinclude')]))"],
        text=True,
    ).strip().split()

    so_file = py_path.with_suffix(".so")  # cythonize produit <name>.cpython-XXX.so

    # Cython 3.x génère directement le .so via cythonize si on lui passe --inplace,
    # mais pour garder le contrôle total on compile manuellement avec gcc.
    # Le nom du .so produit par gcc doit suivre la convention CPython :
    #   <module>.cpython-311-x86_64-linux-gnu.so
    import sysconfig
    ext_suffix = sysconfig.get_config_var("EXT_SUFFIX") or ".so"
    so_target = py_path.with_name(py_path.stem + ext_suffix)

    run([
        "gcc", "-shared", "-fPIC", "-O2",
        *include_flags,
        "-o", str(so_target),
        str(c_file),
    ])

    if not so_target.exists():
        raise RuntimeError(f"gcc n'a pas généré {so_target}")

    # 3. Nettoyage : supprimer le .py source et le .c intermédiaire
    py_path.unlink()
    c_file.unlink()

    print(f"[compile] ✅ {so_target.name} généré ({so_target.stat().st_size} octets)")


def main() -> int:
    print("=" * 60)
    print("Compilation Cython des fichiers critiques (mode production)")
    print(f"BASE_DIR = {BASE_DIR}")
    print("=" * 60)

    # Vérifier que Cython est installé
    try:
        import Cython  # noqa: F401
    except ImportError:
        print("[compile] ❌ Cython n'est pas installé. "
              "Exécuter : pip install cython")
        return 1

    # Vérifier que gcc est disponible
    if not shutil.which("gcc"):
        print("[compile] ❌ gcc introuvable dans le PATH. "
              "Installer build-essential / gcc.")
        return 1

    compiled = 0
    failed = 0
    for rel in PROTECTED_FILES:
        py_path = BASE_DIR / rel
        try:
            compile_one(py_path)
            compiled += 1
        except Exception as exc:
            print(f"[compile] ❌ Échec compilation {rel}: {exc}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Résultat : {compiled} compilé(s), {failed} échec(s)")
    print("=" * 60)

    if failed:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
