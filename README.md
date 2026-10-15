# Mariage Eden & Ilan — invitations et gestion par famille

Branche : `correction-ilan`. Site statique sur GitHub Pages, données dans Google Sheets.
Mairie : **11 février 2027**, Levallois-Perret. Houppa : **18 février 2027 à 16 h,
heure de Paris**, Factory 58, 12 rue Gutenberg, 93000 Bobigny. Chabbat : 19 février.

## Deux espaces distincts

Après publication de cette branche sur le domaine actuel :

- **Dahan** : https://mariage-eden-ilan.com/admindahan/
- **Chiche** : https://mariage-eden-ilan.com/adminchiche/

Chaque famille utilise sa propre clé de gestion. La clé Dahan est refusée dans
l'espace Chiche et inversement. La page `/admin.html` est seulement une orientation
vers les deux adresses ; elle ne contient aucun tableau commun.

Dans chaque espace : création d'invitations, maximum d'adultes et d'enfants,
liste de ses foyers, lien personnel, préparation WhatsApp et export CSV des
effectifs par événement. « Actualiser » relit Google Sheets ; les données ne sont
pas actualisées automatiquement en arrière-plan.

Les tableaux distinguent adultes/enfants invités, adultes/enfants confirmés,
foyers sans réponse et foyers absents. Si un foyer répond plusieurs fois, seule
sa réponse la plus récente (horodatage) compte : les personnes ne sont pas additionnées.
Le CSV reprend ces mêmes effectifs pour communiquer avec le traiteur.

Aucune répartition familiale ni information de frais n'est renvoyée à un invité.
Le calcul des montants à payer n'est pas inclus.

## Installation Google, une seule fois

Le fichier Google Sheets utilisé est :
https://docs.google.com/spreadsheets/d/1rpb6pRC_cQ3_3dYrnFl5WKfFRMgX2KYeFcqdhgQYJxE/edit

1. Ouvrir ce tableau → **Extensions → Apps Script**.
2. Remplacer `Code.gs` par **apps-script/Code.gs de cette version**, puis enregistrer.
3. Dans **Paramètres du projet → Propriétés du script**, définir deux secrets
   **différents**, aléatoires, de 32 caractères minimum :
   - `ADMIN_KEY_DAHAN`
   - `ADMIN_KEY_CHICHE`
   Conserver les valeurs dans un gestionnaire de mots de passe, et remettre à chaque
   famille sa seule clé par un canal privé. Ne pas inscrire les clés dans le dépôt,
   dans le Google Sheets ou dans les liens. L'ancienne `ADMIN_KEY` n'est plus utilisée.
4. **Déployer → Gérer les déploiements → Modifier → Nouvelle version → Déployer**
   sur le service existant, pour garder son URL `/exec`. Exécuter en tant que
   propriétaire, avec accès des invités sans connexion Google ; le tableau lui-même
   peut rester privé. Terminer les autorisations Google dans le compte du propriétaire.
5. Si l'URL `/exec` change, remplacer `endpoint` dans `sheet-api.js`.
6. Publier aussi la branche du site via GitHub Pages. Les deux déploiements sont requis.

Aucune modification du déploiement Google n'a été faite par cette branche.
Ne pas cliquer sur Exécuter pour tester `doPost` : cette fonction attend une requête HTTP.

## Colonnes et migration des anciens invités

L'onglet **Invités** utilise ces en-têtes (ordre libre) :

`ID | Nom | Mairie | Houppa | Shabbat | Max adultes | Max enfants | Famille`

`Famille` vaut `dahan` ou `chiche` et n'est renseignée que par le serveur pour les
nouvelles invitations. Les colonnes manquantes sont ajoutées à la première création
autorisée ; aucune ancienne ligne n'est supprimée.

Pour les invitations déjà présentes, compléter une fois `Max adultes`, `Max enfants`
et `Famille`. Une ancienne ligne sans famille n'apparaît dans aucun espace :
le serveur ne devine pas qui la prend en charge. Un tableau rempli sans colonne
Famille provoque un message de configuration plutôt qu'un récapitulatif incomplet.

`oui`/`non` ou cases à cocher sont acceptés pour les événements. Les limites sont
obligatoires : 1 à 50 adultes, 0 à 50 enfants, par foyer et par événement autorisé.
Avec **2 adultes, 0 enfant**, l'invité choisit 1 ou 2 adultes ; le choix des enfants
est masqué. Le serveur refuse aussi les effectifs excessifs en cas de modification
du navigateur. L'absence est toujours possible.

Le fichier `guests.json` contient uniquement des exemples pour les aperçus et tests.
Le site réel ne l'utilise pas.

## Données privées et réponses

Les lectures et créations administratives nécessitent la bonne clé et passent
uniquement par POST. Le script filtre les données avant de les renvoyer.
Les réponses privées sont rendues dans une iframe HtmlService et transmises par
`postMessage` au domaine explicitement autorisé. Le navigateur vérifie l'origine
Google du message et un identifiant aléatoire de requête. Les clés ne sont pas
insérées dans les URL, les liens WhatsApp, le stockage local ou la réponse du serveur.
Elles restent en mémoire jusqu'à « Fermer l'espace » ou fermeture de la page.

Les lectures publiques sont limitées à l'invitation identifiée par un ID aléatoire
et au reçu d'un envoi. Les liens d'invitation restent partageables : leur possession
permet d'accéder à la carte et de répondre, sans contrôle d'identité supplémentaire.

**Réponses** conserve ses huit colonnes :
`Date | Nom | Mairie | Houppa | Shabbat | Message | ID invité | ID envoi`.
Les anciennes lignes sont préservées. G et H doivent être libres ou déjà porter
ces noms. Les messages et noms sont enregistrés comme texte pour éviter les formules.
Les réponses des événements non autorisés sont remplacées par `Masqué`.

Le POST RSVP opaque est suivi d'une lecture du reçu : la carte ne dit « enregistrée »
que si l'ID d'envoi a été retrouvé. Une nouvelle tentative de la même réponse dans
la même page conserve son ID pour éviter une seconde ligne.

Les anciennes réponses sans ID invité ne sont pas rapprochées par nom, car cela
risquerait d'attribuer les frais au mauvais foyer : un avertissement apparaît dans
la gestion. Vérifier ces lignes avant d'utiliser les chiffres pour le traiteur.

Documentation Google utilisée :
- https://developers.google.com/apps-script/guides/html/restrictions
- https://developers.google.com/apps-script/reference/html/html-output
- https://developers.google.com/apps-script/guides/content

## WhatsApp

Après création, ou via « Lien / WhatsApp » dans la liste, la page prépare le message
validé : gratitude envers Hachem, « Bé’ezrat Hachem », noms Eden et Ilan et lien
personnel. Seuls les événements autorisés sont mentionnés. Le bouton ouvre WhatsApp ;
vous choisissez le destinataire puis confirmez vous-même l'envoi. Aucun envoi automatique.

## Aperçu local

Depuis le dépôt : `python3 -m http.server 8000 --bind 127.0.0.1`.

- Dahan : http://127.0.0.1:8000/admindahan/?preview=1
- Chiche : http://127.0.0.1:8000/adminchiche/?preview=1

Ces aperçus fonctionnent uniquement sur localhost. Les invitations créées sont
stockées dans le navigateur courant et réparties par famille. Les anciens exemples
sans famille ne sont pas affectés automatiquement. Ce mode est explicitement une
démonstration, sans accès privé réel ni écriture Google. Les réponses RSVP y sont
désactivées. Les liens locaux ne doivent pas être envoyés aux vrais invités.

## Tests et validation réelle

`npm install` puis `npm test` (Google Chrome installé). Voir `tests/README.md`.
Les tests utilisent le vrai code du script avec les services Google simulés.
Ils n'envoient aucun message WhatsApp ni aucune réponse au vrai Google Sheets.

Après déploiement dans le compte Google :
1. Se connecter à chaque espace avec sa clé, vérifier le refus de l'autre clé.
2. Créer un foyer de test identifié et vérifier sa ligne avec la bonne famille.
3. Vérifier son lien, le maximum de places et le texte WhatsApp avant tout envoi réel.
4. Répondre pour ce foyer, puis vérifier **Réponses** et les effectifs de sa seule famille.
5. Faire une réponse corrigée et vérifier que seule la plus récente compte dans le CSV.
