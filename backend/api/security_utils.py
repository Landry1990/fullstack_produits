"""
Utilitaires de sécurité pour l'application API.
Fonctions de sanitisation et validation des entrées.
"""
import re
import os
from pathlib import Path
from django.core.exceptions import ValidationError


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize a filename to prevent header injection and path traversal.
    
    - Removes path traversal sequences (../, ..\)
    - Removes control characters and null bytes
    - Removes dangerous characters (< > : " | ? * \x00)
    - Limits length to max_length
    
    Args:
        filename: The raw filename to sanitize
        max_length: Maximum allowed length (default 255)
    
    Returns:
        A safe filename string
    """
    if not filename:
        return "unnamed"
    
    # Convert to string if not already
    filename = str(filename)
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Get basename only (prevent path traversal)
    filename = os.path.basename(filename)
    
    # Remove dangerous characters that could break headers or cause issues
    # Keep only: alphanumeric, spaces, dots, dashes, underscores
    filename = re.sub(r'[^\w\s.-]', '_', filename)
    
    # Collapse multiple underscores/spaces
    filename = re.sub(r'[_\s]+', '_', filename)
    
    # Remove leading/trailing dots and underscores
    filename = filename.strip('._')
    
    # Limit length
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    
    # Ensure we have something left
    if not filename:
        filename = "unnamed"
    
    return filename


def validate_safe_path(base_path: Path, user_path: str) -> Path:
    """
    Validate that a user-provided path stays within the base directory.
    
    Args:
        base_path: The allowed base directory
        user_path: The path provided by the user
    
    Returns:
        Resolved Path object if safe
    
    Raises:
        ValidationError: If path traversal is detected
    """
    # Resolve the base path to absolute
    base_path = base_path.resolve()
    
    # Clean and resolve the user path
    # Remove null bytes first
    user_path = user_path.replace('\x00', '')
    
    # Get basename only to prevent directory traversal
    user_path = os.path.basename(user_path)
    
    # Construct the full path
    full_path = base_path / user_path
    
    # Resolve to absolute path
    try:
        resolved_path = full_path.resolve()
    except (OSError, ValueError) as e:
        raise ValidationError(f"Chemin invalide: {e}")
    
    # Ensure the resolved path is within the base directory
    try:
        resolved_path.relative_to(base_path)
    except ValueError:
        raise ValidationError("Accès au répertoire non autorisé (path traversal détecté)")
    
    return resolved_path


def build_safe_content_disposition(filename: str) -> str:
    """
    Build a safe Content-Disposition header value.
    
    Uses RFC 5987 encoding for non-ASCII characters and
    sanitizes the filename to prevent header injection.
    
    Args:
        filename: The raw filename
    
    Returns:
        Safe Content-Disposition header value
    """
    from urllib.parse import quote
    
    # Sanitize the filename first
    safe_filename = sanitize_filename(filename)
    
    # For ASCII filenames, use simple format
    try:
        safe_filename.encode('ascii')
        return f'attachment; filename="{safe_filename}"'
    except UnicodeEncodeError:
        # For non-ASCII, use RFC 5987 encoding
        encoded = quote(safe_filename, safe='')
        return f"attachment; filename*=UTF-8''{encoded}"
