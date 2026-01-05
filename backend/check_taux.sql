-- Vérifier les clients professionnels et leur taux de couverture
SELECT 
    id,
    name,
    client_type,
    taux_couverture,
    plafond
FROM api_client
WHERE client_type = 'PROFESSIONNEL'
ORDER BY name;
