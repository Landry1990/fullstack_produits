import os
import zipfile
import io
import shutil
from datetime import datetime
from django.conf import settings
from django.http import HttpResponse, FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

class CodeBackupViewSet(ViewSet):
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def backup(self, request):
        """
        Create a ZIP of the source code.
        """
        project_root = settings.BASE_DIR
        buffer = io.BytesIO()
        
        # Folders to exclude from backup
        exclude_dirs = {
            '.git', '.idea', '__pycache__', 'node_modules', 
            'venv', 'backups', 'logs', '.venv', 'my_env01'
        }
        exclude_files = {'.env', 'db.sqlite3'}

        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(project_root):
                # Modify dirs in-place to skip excluded directories
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                
                for file in files:
                    if file in exclude_files:
                        continue
                        
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, project_root)
                    zf.write(full_path, rel_path)

        buffer.seek(0)
        filename = f"source_code_backup_{datetime.now().strftime('%Y%m%d_%H%M')}.zip"
        
        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['post'])
    def restore(self, request):
        """
        Restore source code from a ZIP file.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'Fichier ZIP requis.'}, status=status.HTTP_400_BAD_REQUEST)

        # Basic validation: check if it's a ZIP
        if not file_obj.name.endswith('.zip'):
            return Response({'detail': 'Le fichier doit être un .zip.'}, status=status.HTTP_400_BAD_REQUEST)

        project_root = settings.BASE_DIR
        
        try:
            with zipfile.ZipFile(file_obj, 'r') as zf:
                # Extract all files, overwriting existing ones
                # NOTE: This is dangerous and will update the running code!
                zf.extractall(project_root)
                
            return Response({'message': 'Code source restauré avec succès. Redémarrez le serveur pour appliquer les changements.'})
        except Exception as e:
            return Response({'detail': f'Erreur lors de la restauration: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
