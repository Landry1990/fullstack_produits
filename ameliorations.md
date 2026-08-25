1. Le disque qui se remplit (probabilité : très élevée)
Source	Pourquoi
WAL archives	archive_mode=on dans ta config Postgres → les fichiers WAL s'accumulent dans /wal_archive. Sans rotation, le disque se remplit en quelques semaines
Backups automatiques	backups grossit à chaque backup-db.sh. Sans purge, idem
Logs Docker	json-file driver sans max-size → les logs des containers peuvent atteindre plusieurs GB
Redis AOF	Tu as --appendonly no donc OK, mais --save 60 1000 écrit des RDB snapshots
Le piège : quand le disque est plein, Postgres refuse les écritures → l'app paraît "cassée" sans message clair.

2. Les migrations qui passent en dev mais bloquent en prod
AddField avec default= sur une table avec 50 000 lignes → Postgres fait un full table rewrite qui peut bloquer l'app plusieurs minutes
En dev tu as ~100 produits, en prod tu peux en avoir 8 000+ → les requêtes lentes apparaissent
Une migration qui fait RunSQL sans timeout peut bloquer indéfiniment si un lock est tenu
3. Les coupures électrique (probabilité : élevée en pharmacie)
Le serveur s'éteint brutalement → Postgres fait un recovery au redémarrage (replay WAL)
Si le volume fullstack_postgres_data_protected est corrompu → la base ne démarre pas
restart: always aide, mais ne répare pas une base corrompue
Solution : backups réguliers + monitoring de l'espace disque
4. Les 4 workers Uvicorn et la mémoire


UVICORN_WORKERS=4 + memory limit 4G
Chaque worker charge Django + Django ORM + Pandas (pour les imports) → peut dépasser 1G/worker
Si les 4 workers font un import lourd en même temps → OOM kill → container redémarre → requête utilisateur perdue
En dev tu as 1-2 utilisateurs, en prod tu peux en avoir 5-10 simultanés
5. Le cache Redis qui se vide
allkeys-lru + maxmemory 256mb (dev) / 384mb (prod)
Si le cache est plein et qu'une nouvelle clé est ajoutée → une clé existante est évictée
Conséquence : les sessions utilisateurs peuvent être perdues → déconnexion inattendue
Les clés d'idempotence qu'on vient d'ajouter peuvent aussi être évictées → double exécution possible si le retry arrive après eviction
6. Le PWA qui affiche une vieille version
Tu déploies → l'utilisateur voit encore l'ancienne version
Le service worker cache agressivement (184 entries, 7.9 MB)
Solution : Ctrl+F5, mais le pharmacien ne le sait pas toujours
Ton generate-version.mjs génère un hash → vérifie que le SW se met à jour correctement
7. Tailscale qui se déconnecte
Si Tailscale perd la connexion → plus d'accès distant pour le support
Le pharmacien en local continue à travailler (OK), mais toi tu ne peux plus intervenir
Le TS_AUTHKEY peut expirer → le container redémarre en boucle
8. Les impressions thermiques
Les tickets de caisse utilisent des polices spécifiques qui peuvent ne pas être installées dans l'image Docker
Les PDF générés côté backend peuvent échouer si une lib est manquante
En dev ça marche car tu as tout en local, en prod l'image Docker est isolée
9. Le timezone
Si le serveur est en UTC et la pharmacie en UTC+1 → les rapports "du jour" sont faux
Les clôtures de caisse à minuit peuvent tomber au mauvais jour
Vérifie TIME_ZONE dans settings.py
10. La licence qui expire
Si le système de licence a un bug ou un edge case → la pharmacie est bloquée
Pas de moyen de contournement rapide sans accès SSH
Le code keyday que tu as mis en place aide, mais il faut que le pharmacien t'appelle