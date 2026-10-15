# Vérification

`npm test` exécute le vrai code du site et `apps-script/Code.gs`, avec les services
Google Sheets, PropertiesService, LockService et HtmlService simulés.
Les pages navigateur utilisent Google Chrome et un serveur HTTP local.

Les tests couvrent notamment :
- clés différentes par famille, refus de lecture et création sur l'autre espace ;
- absence de répartition familiale dans les réponses publiques aux invités ;
- communication privée par POST et réponse postMessage, origine et identifiant vérifiés ;
- création, plafonds adultes/enfants, invités inconnus et répétitions d'envoi ;
- génération et ouverture du lien WhatsApp sur une destination simulée, texte et lien personnel ;
- réponse RSVP → écriture → dernière réponse retenue → effectifs par événement → export CSV ;
- formats mobiles et animation d'ouverture.

Aucun message WhatsApp réel n'est envoyé. Aucun enregistrement n'est créé sur le
vrai Google Sheets. La validation réelle nécessite de déployer le script dans le
compte du propriétaire, puis d'envoyer une réponse d'un foyer de test clairement
identifié et de la retrouver dans Google Sheets et dans le bon espace famille.
