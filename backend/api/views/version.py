import os
import subprocess
from pathlib import Path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _read_version() -> str:
    """Lit le fichier VERSION à la racine du projet."""
    version_file = Path(__file__).resolve().parents[3] / 'VERSION'
    try:
        return version_file.read_text().strip()
    except FileNotFoundError:
        return 'inconnue'


def _read_git_info() -> dict:
    """Récupère le dernier commit git et la date."""
    try:
        commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            stderr=subprocess.DEVNULL,
            cwd=Path(__file__).resolve().parents[3]
        ).decode().strip()
        date = subprocess.check_output(
            ['git', 'log', '-1', '--format=%ci'],
            stderr=subprocess.DEVNULL,
            cwd=Path(__file__).resolve().parents[3]
        ).decode().strip()
        return {'commit': commit, 'commit_date': date}
    except Exception:
        return {'commit': None, 'commit_date': None}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def app_version(request):
    git = _read_git_info()
    return Response({
        'version': _read_version(),
        'commit': git['commit'],
        'commit_date': git['commit_date'],
    })
