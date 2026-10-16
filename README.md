# Mariage Eden & Ilan — invitations et gestion par famille

Branche : `correction-ilan`. Site statique sur GitHub Pages, données dans Google Sheets.
Mairie : **11 février 2027**, Levallois-Perret. Houppa : **18 février 2027 à 16 h,
heure de Paris**, Factory 58, 12 rue Gutenberg, 93000 Bobigny. Chabbat : 19 février.

## Deux espaces distincts

Après publication de cette branche sur le domaine actuel :

- **Dahan** : https://mariage-eden-ilan.com/admindahan/
- **Chiche** : https://mariage-eden-ilan.com/adminchiche/

Chaque famille ouvre son propre long lien privé, sans mot de passe à saisir.
Le secret Dahan est refusé dans l’espace Chiche et inversement.
Les adresses ci-dessus, sans leur partie secrète `#acces=…`, n’ouvrent aucune donnée. La page `/admin.html` est seulement une orientation
vers les deux adresses ; elle ne contient aucun tableau commun.

Dans chaque espace : création d'invitations, nombre maximum de personnes,
liste de ses foyers, lien personnel, préparation WhatsApp et export CSV des
effectifs par événement. « Actualiser » relit Google Sheets ; les données ne sont
pas actualisées automatiquement en arrière-plan.

Les tableaux distinguent personnes invitées, personnes confirmées,
foyers sans réponse et foyers absents. Si un foyer répond plusieurs fois, seule
sa réponse la plus récente (horodatage) compte : les personnes ne sont pas additionnées.
Le CSV reprend ces mêmes effectifs pour communiquer avec le traiteur.

La liste des foyers propose une recherche par nom, sans distinction de casse ou
d’accents, et un filtre « Sans réponse » (au moins un événement en attente).
« Préparer une relance » affiche un message WhatsApp avec uniquement les événements
sans réponse et le lien personnel. Vous choisissez ensuite le destinataire et
validez l’envoi dans WhatsApp. Les filtres ne modifient ni les totaux ni le CSV.

Aucune répartition familiale ni information de frais n'est renvoyée à un invité.
Le calcul des montants à payer n'est pas inclus.

## Installation Google, une seule fois

Le fichier Google Sheets utilisé est :
https://docs.google.com/spreadsheets/d/1rpb6pRC_cQ3_3dYrnFl5WKfFRMgX2KYeFcqdhgQYJxE/edit

1. Ouvrir ce tableau → **Extensions → Apps Script**.
2. Remplacer `Code.gs` par **apps-script/Code.gs de cette version**, puis enregistrer.
3. Revenir au Google Sheets et **actualiser sa page**. Un menu **Invitations**
   apparaît. Choisir **Invitations → Afficher mes liens privés** et terminer
   l'autorisation Google si elle est demandée. Une fenêtre affiche les deux liens
   complets, Dahan et Chiche : les copier et les conserver. Aucune clé à inventer
   ni à saisir ; le script crée automatiquement deux secrets longs et différents
   dans ses propriétés privées. À défaut de menu, choisir `afficherLiensPrives`
   dans l'éditeur Apps Script puis Exécuter, et revenir au tableau ouvert.
   Ne jamais exécuter `doGet` ou `doPost` manuellement.
4. **Déployer → Gérer les déploiements → Modifier → Nouvelle version → Déployer**
   sur le service existant, pour garder son URL `/exec`. Exécuter en tant que
   propriétaire, avec accès des invités sans connexion Google ; le tableau lui-même
   peut rester privé. Terminer les autorisations Google dans le compte du propriétaire.
5. Si l'URL `/exec` change, remplacer `endpoint` dans `sheet-api.js`.
6. Publier aussi la branche du site via GitHub Pages. Les deux déploiements sont requis pour que les liens privés fonctionnent.

Aucune modification du déploiement Google n'a été faite par cette branche.
Ne pas cliquer sur Exécuter pour tester `doPost` : cette fonction attend une requête HTTP.

## Colonnes et migration des anciens invités

L'onglet **Invités** utilise ces en-têtes (ordre libre) :

`ID | Nom | Mairie | Houppa | Shabbat | Max personnes | Famille`

`Famille` vaut `dahan` ou `chiche` et n'est renseignée que par le serveur pour les
nouvelles invitations. Les colonnes manquantes sont ajoutées à la première création
autorisée ; aucune ancienne ligne n'est supprimée.

Pour les invitations déjà présentes, les anciennes colonnes `Max adultes` et
`Max enfants` restent compatibles : leur somme devient le maximum de personnes
si `Max personnes` est vide. Les anciennes réponses sont également additionnées.
Une ancienne ligne sans `Famille` n'apparaît dans aucun espace : compléter cette
colonne avec `dahan` ou `chiche` ; le serveur ne devine pas qui la prend en charge.

`oui`/`non` ou cases à cocher sont acceptés pour les événements. Le maximum est
compris entre 1 et 100 personnes par foyer et par événement autorisé.
Avec **2 personnes maximum**, l'invité choisit 1 ou 2 personnes.
Le serveur refuse aussi les effectifs excessifs en cas de modification du navigateur.
L'absence est toujours possible.

Le fichier `guests.json` contient uniquement des exemples pour les aperçus et tests.
Le site réel ne l'utilise pas.

Les liens générés incluent aussi `nom` pour afficher immédiatement le destinataire
sur l’enveloppe. Ce nom est visible dans le lien et ne donne aucun droit : après
chargement, Google Sheets fournit le nom de référence, les événements et les places.
Les anciens liens sans nom restent compatibles.

## Données privées et réponses

Les lectures et créations administratives nécessitent la bonne clé et passent
uniquement par POST. Le script filtre les données avant de les renvoyer.
Les réponses privées sont rendues dans une iframe HtmlService et transmises par
`postMessage` au domaine explicitement autorisé. Le navigateur vérifie l'origine
Google du message et un identifiant aléatoire de requête. Le secret de gestion est intégré uniquement au fragment `#acces=…` du lien privé :
ce fragment n'est pas envoyé dans l'URL des requêtes HTTP. Le site l'utilise pour
s'authentifier dans le corps des POST. Il n'est jamais ajouté aux liens des invités,
aux messages WhatsApp, au stockage local ou aux réponses administratives du serveur.
Le lien reste dans la barre d'adresse pour permettre l'actualisation et sa sauvegarde
en favori. « Fermer l'espace » efface les données affichées et retire le fragment ;
rouvrir le lien complet conservé pour se reconnecter.

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
1. Ouvrir chaque long lien privé sans saisir de mot de passe ; vérifier que le secret
   d’une famille ne permet pas d’accéder à l’autre.
2. Créer un foyer de test identifié et vérifier sa ligne avec la bonne famille.
3. Vérifier son lien, le maximum de places et le texte WhatsApp avant tout envoi réel.
4. Répondre pour ce foyer, puis vérifier **Réponses** et les effectifs de sa seule famille.
5. Faire une réponse corrigée et vérifier que seule la plus récente compte dans le CSV.

## Un seul fichier Google Sheets

Les deux espaces utilisent le même `SPREADSHEET_ID`, déjà configuré dans le code.
Il n'y a pas deux fichiers à créer : **Invités** rassemble les foyers avec une
colonne `Famille` qui sert au filtrage côté serveur ; **Réponses** rassemble leurs
réponses. Les pages affichent ensuite le récapitulatif simple de leur seule famille.

`afficherLiensPrives` ajoute seulement les en-têtes manquants et crée les secrets
si nécessaire. Il ne supprime aucune ancienne ligne et ne change pas les liens déjà
créés quand on le relance. Les anciens foyers doivent être affectés une fois à leur
famille avec leurs limites de places s'ils ne l'ont pas encore été.

La fenêtre des liens privés repose sur l'interface Google Sheets du projet lié :
https://developers.google.com/apps-script/reference/base/ui#showModalDialog(HtmlOutput,String)
Les liens de gestion donnent accès aux données à toute personne qui les possède ;
les conserver entre les organisateurs et envoyer seulement les liens personnels
aux invités. Ne pas publier les liens de gestion dans GitHub ni dans les cellules.

## Musique

Le fichier `assets/audio/gan-eden.mp3` est lu au clic sur « Découvrir
l’invitation » ou « Découvrir le programme », sans lecture automatique au
chargement. Un bouton fixe permet de mettre en pause et reprendre. Le morceau
boucle à volume modéré ; si le navigateur bloque la lecture, le bouton permet
de réessayer. Le lecteur utilise `preload="none"` pour préserver le chargement
initial de la carte.
