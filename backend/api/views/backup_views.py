"""
API pour la gestion des backups depuis l'interface web
Permet aux pharmaciens de restaurer sans ligne de commande
"""
import os
import gzip
import glob
import subprocess
from datetime import datetime, timedelta
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Configuration
BACKUP_DIR = getattr(settings, 'BACKUP_INCREMENTAL_DIR', '/backup/incremental')
FULL_BACKUP_DIR = getattr(settings, 'BACKUP_FULL_DIR', '/backup/full')
DB_NAME = settings.DATABASES['default']['NAME']
DB_USER = settings.DATABASES['default']['USER']
CONTAINER = settings.DOCKER_DB_CONTAINER


class BackupListView(APIView):
    """Lister tous les backups disponibles"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        try:
            backups = []
            
            # Backups incrémentaux
            if os.path.exists(BACKUP_DIR):
                for filepath in glob.glob(f"{BACKUP_DIR}/*.sql.gz"):
                    filename = os.path.basename(filepath)
                    stat = os.stat(filepath)
                    
                    # Extraire timestamp et table du nom: 20240609_143000_api_facture.sql.gz
                    parts = filename.replace('.sql.gz', '').split('_')
                    if len(parts) >= 3:
                        date_str = parts[0]
                        time_str = parts[1]
                        table = '_'.join(parts[2:])
                        
                        timestamp = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
                        date_formatted = f"{date_str[6:]}/{date_str[4:6]}/{date_str[:4]} à {time_str[:2]}:{time_str[2:4]}"
                        
                        size_bytes = stat.st_size
                        if size_bytes < 1024:
                            size_formatted = f"{size_bytes} B"
                        elif size_bytes < 1024 * 1024:
                            size_formatted = f"{size_bytes / 1024:.1f} KB"
                        else:
                            size_formatted = f"{size_bytes / (1024 * 1024):.1f} MB"
                        
                        backups.append({
                            'filename': filename,
                            'timestamp': timestamp,
                            'date_formatted': date_formatted,
                            'size_bytes': size_bytes,
                            'size_formatted': size_formatted,
                            'type': 'incremental',
                            'table': table
                        })
            
            # Backups complets
            if os.path.exists(FULL_BACKUP_DIR):
                for filepath in glob.glob(f"{FULL_BACKUP_DIR}/*.sql.gz"):
                    filename = os.path.basename(filepath)
                    stat = os.stat(filepath)
                    
                    # Extraire timestamp: full_20240609_080000.sql.gz
                    parts = filename.replace('.sql.gz', '').split('_')
                    if len(parts) >= 3:
                        date_str = parts[1]
                        time_str = parts[2]
                        
                        timestamp = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
                        date_formatted = f"{date_str[6:]}/{date_str[4:6]}/{date_str[:4]} à {time_str[:2]}:{time_str[2:4]} (Complet)"
                        
                        size_bytes = stat.st_size
                        if size_bytes < 1024 * 1024:
                            size_formatted = f"{size_bytes / 1024:.1f} KB"
                        else:
                            size_formatted = f"{size_bytes / (1024 * 1024):.1f} MB"
                        
                        backups.append({
                            'filename': filename,
                            'timestamp': timestamp,
                            'date_formatted': date_formatted,
                            'size_bytes': size_bytes,
                            'size_formatted': size_formatted,
                            'type': 'full',
                            'tables': ['Structure + Toutes les données']
                        })
            
            # Grouper les backups incrémentaux par timestamp
            grouped_backups = {}
            for b in backups:
                if b['type'] == 'incremental':
                    key = b['timestamp']
                    if key not in grouped_backups:
                        grouped_backups[key] = {
                            **b,
                            'tables': [b['table']],
                            'filename': f"group_{b['timestamp']}"
                        }
                    else:
                        grouped_backups[key]['tables'].append(b['table'])
                        grouped_backups[key]['size_bytes'] += b['size_bytes']
            
            # Reformatter les tailles groupées
            final_backups = []
            for b in grouped_backups.values():
                size_bytes = b['size_bytes']
                if size_bytes < 1024:
                    b['size_formatted'] = f"{size_bytes} B"
                elif size_bytes < 1024 * 1024:
                    b['size_formatted'] = f"{size_bytes / 1024:.1f} KB"
                else:
                    b['size_formatted'] = f"{size_bytes / (1024 * 1024):.1f} MB"
                final_backups.append(b)
            
            # Ajouter les backups complets
            final_backups.extend([b for b in backups if b['type'] == 'full'])
            
            # Trier par date (plus récent d'abord)
            final_backups.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return Response({
                'backups': final_backups,
                'count': len(final_backups),
                'incremental_dir': BACKUP_DIR,
                'full_dir': FULL_BACKUP_DIR
            })
            
        except Exception as e:
            logger.error(f"Erreur listage backups: {str(e)}")
            return Response(
                {'error': 'Erreur lors du listage des backups'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CreateBackupView(APIView):
    """Créer un backup manuel"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            tables_backed_up = 0
            
            # Tables critiques à sauvegarder
            tables = [
                'api_facture', 'api_lignefacture', 'api_sessionticket',
                'api_mouvementstock', 'api_inventaire', 'api_ligneinventaire',
                'api_ecriture', 'api_operation', 'api_journalcaisse',
                'api_commande', 'api_lignecommande', 'api_couponmonnaie',
                'api_sessioncaisse', 'api_client', 'api_paiement'
            ]
            
            os.makedirs(BACKUP_DIR, exist_ok=True)
            
            for table in tables:
                try:
                    output_file = f"{BACKUP_DIR}/{timestamp}_{table}.sql"
                    
                    # Exporter la table
                    result = subprocess.run([
                        'docker', 'exec', CONTAINER,
                        'pg_dump', '-U', DB_USER, '-d', DB_NAME,
                        '--data-only', '--inserts', '--no-owner', '--no-privileges',
                        '--table', table
                    ], capture_output=True, text=True, timeout=30)
                    
                    if result.returncode == 0 and result.stdout:
                        with open(output_file, 'w') as f:
                            f.write(result.stdout)
                        
                        # Compresser
                        with open(output_file, 'rb') as f_in:
                            with gzip.open(f"{output_file}.gz", 'wb') as f_out:
                                f_out.write(f_in.read())
                        
                        os.remove(output_file)
                        tables_backed_up += 1
                        
                except Exception as e:
                    logger.warning(f"Erreur backup table {table}: {str(e)}")
                    continue
            
            logger.info(f"Backup manuel créé: {tables_backed_up} tables")
            
            return Response({
                'success': True,
                'tables_backed_up': tables_backed_up,
                'timestamp': timestamp,
                'message': f'{tables_backed_up} tables sauvegardées'
            })
            
        except Exception as e:
            logger.error(f"Erreur création backup: {str(e)}")
            return Response(
                {'error': f'Erreur lors de la création du backup: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestoreBackupView(APIView):
    """Restaurer un backup"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        filename = request.data.get('filename')
        backup_type = request.data.get('type', 'incremental')
        
        if not filename:
            return Response(
                {'error': 'Nom de fichier requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Vérifier le fichier
            if backup_type == 'full':
                backup_path = f"{FULL_BACKUP_DIR}/{filename}"
            else:
                # Pour les backups groupés, on restaure tous les fichiers du timestamp
                if filename.startswith('group_'):
                    timestamp = filename.replace('group_', '')
                    backup_files = glob.glob(f"{BACKUP_DIR}/{timestamp}_*.sql.gz")
                else:
                    backup_path = f"{BACKUP_DIR}/{filename}"
                    backup_files = [backup_path] if os.path.exists(backup_path) else []
            
            if backup_type == 'full' and not os.path.exists(backup_path):
                return Response(
                    {'error': 'Backup complet non trouvé'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Arrêter le backend
            try:
                subprocess.run(['docker', 'stop', settings.DOCKER_BACKEND_CONTAINER], 
                             capture_output=True, timeout=10)
            except:
                pass
            
            stats = {'factures_restored': 0, 'last_transaction': None}
            
            if backup_type == 'full':
                # Restauration complète
                # Sauvegarde d'urgence
                emergency_file = f"{BACKUP_DIR}/emergency_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql.gz"
                try:
                    result = subprocess.run([
                        'docker', 'exec', CONTAINER,
                        'pg_dumpall', '-U', DB_USER
                    ], capture_output=True, text=True, timeout=60)
                    
                    if result.returncode == 0:
                        with gzip.open(emergency_file, 'wt') as f:
                            f.write(result.stdout)
                except:
                    pass
                
                # Recréer la base
                subprocess.run([
                    'docker', 'exec', CONTAINER,
                    'psql', '-U', DB_USER, '-c', f'DROP DATABASE IF EXISTS {DB_NAME};'
                ], capture_output=True)
                
                subprocess.run([
                    'docker', 'exec', CONTAINER,
                    'psql', '-U', DB_USER, '-c', f'CREATE DATABASE {DB_NAME};'
                ], capture_output=True)
                
                # Restaurer
                with gzip.open(backup_path, 'rt') as f:
                    result = subprocess.run([
                        'docker', 'exec', '-i', CONTAINER,
                        'psql', '-U', DB_USER, '-d', DB_NAME
                    ], stdin=f, capture_output=True, text=True)
                
            else:
                # Restauration incrémentale (appliquer chaque fichier)
                for backup_file in sorted(backup_files):
                    with gzip.open(backup_file, 'rt') as f:
                        subprocess.run([
                            'docker', 'exec', '-i', CONTAINER,
                            'psql', '-U', DB_USER, '-d', DB_NAME
                        ], stdin=f, capture_output=True)
            
            # Obtenir les stats post-restauration
            try:
                result = subprocess.run([
                    'docker', 'exec', CONTAINER,
                    'psql', '-U', DB_USER, '-d', DB_NAME,
                    '-t', '-c',
                    'SELECT COUNT(*), MAX(date) FROM api_facture;'
                ], capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    parts = result.stdout.strip().split('|')
                    if len(parts) >= 2:
                        stats['factures_restored'] = parts[0].strip()
                        stats['last_transaction'] = parts[1].strip()
            except:
                pass
            
            # Redémarrer le backend
            try:
                subprocess.run(['docker', 'start', settings.DOCKER_BACKEND_CONTAINER],
                             capture_output=True, timeout=10)
            except:
                pass
            
            logger.info(f"Restauration réussie: {filename}")
            
            return Response({
                'success': True,
                'message': 'Restauration terminée',
                'stats': stats
            })
            
        except Exception as e:
            logger.error(f"Erreur restauration: {str(e)}")
            
            # Essayer de redémarrer le backend en cas d'erreur
            try:
                subprocess.run(['docker', 'start', settings.DOCKER_BACKEND_CONTAINER],
                               capture_output=True)
            except:
                pass
            
            return Response(
                {'error': f'Erreur lors de la restauration: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeleteBackupView(APIView):
    """Supprimer un backup"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def delete(self, request, filename):
        try:
            # Chercher le fichier (incrémental ou complet)
            paths_to_check = [
                f"{BACKUP_DIR}/{filename}",
                f"{FULL_BACKUP_DIR}/{filename}"
            ]
            
            # Pour les backups groupés, supprimer tous les fichiers du timestamp
            if filename.startswith('group_'):
                timestamp = filename.replace('group_', '')
                files = glob.glob(f"{BACKUP_DIR}/{timestamp}_*.sql.gz")
                for f in files:
                    os.remove(f)
                    logger.info(f"Backup supprimé: {f}")
            else:
                for path in paths_to_check:
                    if os.path.exists(path):
                        os.remove(path)
                        logger.info(f"Backup supprimé: {path}")
                        break
            
            return Response({'success': True, 'message': 'Backup supprimé'})
            
        except Exception as e:
            logger.error(f"Erreur suppression backup: {str(e)}")
            return Response(
                {'error': f'Erreur lors de la suppression: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
