Option 2 : Désactiver l'obligation du jeton dans votre script .sh
Si vous créez un script d'installation automatique et que vous ne voulez pas que vos utilisateurs s'embêtent à chercher ce jeton dans les logs, vous pouvez désactiver cette option au lancement. [1]
Modifiez la commande docker run à l'intérieur de votre script .sh en y ajoutant le drapeau --no-setup-token tout à la fin : [1]

Solution 2 : Intégrer la solution définitive dans votre script .sh
Pour que votre script d'installation automatique ne bloque plus jamais sur cette erreur, vous devez vous assurer que l'utilisateur qui lance le script fait partie du groupe docker.
Ajoutez ces lignes au tout début de votre fichier .sh :
bash
# Vérifie si l'utilisateur actuel a accès à docker, sinon l'ajoute au groupe
if ! docker ps >/dev/null 2>&1; then
    echo "Configuring Docker permissions..."
    sudo usermod -aG docker $USER
    echo "⚠️ Droits mis à jour. Veuillez relancer le script ou exécuter 'newgrp docker'."
    exec newgrp docker "$0" "$@"
    exit
fi

Comment automatiser cette sécurité dans votre script .sh
Si vous écrivez un script d'installation, il est fréquent que l'utilisateur mette du temps avant d'ouvrir son navigateur. Vous pouvez ajouter un paramètre au démarrage du conteneur dans votre script pour désactiver ou prolonger ce délai de sécurité.
Ajoutez l'option --no-auth ou modifiez la durée avec --admin-password-timeout lors du docker run.
Exemple à intégrer dans votre script .sh :
bash
docker run -d -p 9000:9000 -p 9443:9443 --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest \
  --admin-password-timeout 3600

Utilisez le code avec précaution.
Le paramètre --admin-password-timeout 3600 (à la toute fin) laisse une fenêtre de 1 heure au lieu de 10 minutes pour configurer le compte.
Si vous le souhaitez, je peux vous aider sur l'un de ces points :
Ajuster la commande de votre script avec le nouveau paramètre de tempsCréer un script pour déployer automatiquement votre application une fois Portainer configuré
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
Cette erreur revient car le conteneur Portainer que vous venez de redémarrer (ou votre utilisateur actuel) n'a plus les droits pour lire le fichier docker.sock.
Voici comment régler ce problème définitivement pour que Portainer et votre script fonctionnent à tous les coups.
Solution 1 : Corriger les permissions du fichier socket (Le plus rapide)
Exécutez cette commande sur votre machine hôte pour donner temporairement les droits de lecture/écriture au fichier :
bash
sudo chmod 666 /var/run/docker.sock

Utilisez le code avec précaution.
Note : Cette commande résout le problème immédiatement, mais les permissions peuvent se réinitialiser si le service Docker ou la machine redémarre.
Solution 2 : Intégrer la solution définitive dans votre script .sh
Pour que votre script d'installation automatique ne bloque plus jamais sur cette erreur, vous devez vous assurer que l'utilisateur qui lance le script fait partie du groupe docker.
Ajoutez ces lignes au tout début de votre fichier .sh :
bash
# Vérifie si l'utilisateur actuel a accès à docker, sinon l'ajoute au groupe
if ! docker ps >/dev/null 2>&1; then
    echo "Configuring Docker permissions..."
    sudo usermod -aG docker $USER
    echo "⚠️ Droits mis à jour. Veuillez relancer le script ou exécuter 'newgrp docker'."
    exec newgrp docker "$0" "$@"
    exit
fi

Utilisez le code avec précaution.
Étape suivante
Une fois les permissions corrigées, relancez votre conteneur avec la commande de redémarrage précédente :
bash
docker restart portainer

Utilisez le code avec précaution.
Dites-moi si la commande chmod a débloqué l'accès ou si vous préférez que l'on vérifie ensemble :
Le contenu actuel de votre fichier .shLes groupes auxquels votre utilisateur est associé
comment faire pour avoir mon etup token
Le jeton de configuration (Setup Token) est une sécurité requise par Portainer lors du premier démarrage pour valider que vous êtes bien l'administrateur du serveur. [1]
Option 1 : Récupérer le jeton généré automatiquement (Recommandé)
Le jeton se trouve directement dans les logs de votre conteneur Docker. Pour l'afficher, exécutez cette commande dans votre terminal : [1]
bash
docker logs portainer 2>&1 | grep "setup_token="

Utilisez le code avec précaution.
·Ce qu'il faut faire : Copiez la longue suite de caractères qui s'affiche après setup_token= et collez-la dans la case demandée sur l'interface web de Portainer.
·Attention : Vous devez créer votre compte administrateur dans les 5 minutes qui suivent la récupération du jeton. [1]
Option 2 : Désactiver l'obligation du jeton dans votre script .sh
Si vous créez un script d'installation automatique et que vous ne voulez pas que vos utilisateurs s'embêtent à chercher ce jeton dans les logs, vous pouvez désactiver cette option au lancement. [1]
Modifiez la commande docker run à l'intérieur de votre script .sh en y ajoutant le drapeau --no-setup-token tout à la fin : [1]
bash
docker run -d -p 9000:9000 -p 9443:9443 --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest \
  --no-setup-token

Utilisez le code avec précaution.
(Une fois cette modification faite, supprimez l'ancien conteneur bloqué avec docker rm -f portainer et relancez votre script. Portainer s'ouvrira directement sans rien demander). [1]
Quelle méthode préférez-vous appliquer pour la suite de votre projet ?
Extraire le token des logs sans le filtre grep si la commande est videAjouter un mot de passe par défaut directement dans le scrip