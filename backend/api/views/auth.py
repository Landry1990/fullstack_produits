from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_password(request):
    """
    Verifies the password for the currently authenticated user.
    """
    password = request.data.get('password')
    if not password:
        return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    if user.check_password(password):
        return Response({'success': True}, status=status.HTTP_200_OK)
    else:
        return Response({'success': False, 'error': 'Mot de passe incorrect'}, status=status.HTTP_403_FORBIDDEN)
