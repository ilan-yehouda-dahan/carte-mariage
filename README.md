# Carte de mariage Eden & Ilan

Branche : `correction-ilan`. Houppa le 18 février 2027 à **16 h, heure de Paris**,
à **Factory 58, 12 rue Gutenberg, 93000 Bobigny**. Compteur, Waze et calendrier alignés.

## Source des invités

L'onglet **Invités** du Google Sheets est désormais la source utilisée par le site :
https://docs.google.com/spreadsheets/d/1rpb6pRC_cQ3_3dYrnFl5WKfFRMgX2KYeFcqdhgQYJxE/edit

Première ligne : `ID | Nom | Mairie | Houppa | Shabbat | Max adultes | Max enfants`.
Une ligne par foyer. Chaque ID doit être unique. Autorisations : `oui` / `non`
(les cases à cocher booléennes fonctionnent aussi ; une cellule vide vaut non).
Exemple à adapter dans le tableau, sans remplacer les invités existants :

| ID | Nom | Mairie | Houppa | Shabbat | Max adultes | Max enfants |
| --- | --- | --- | --- | --- | --- | --- |
| famille-exemple | Famille Exemple | non | oui | non | 2 | 0 |

Lien : `https://mariage-eden-ilan.com/?invite=famille-exemple`.
Les anciens liens `?id=famille-exemple` fonctionnent aussi. Utiliser les ID réels
du tableau : `ilan-dahan` a renvoyé `not found` lors du test de lecture de l'ancien service.
Le fichier `guests.json` reste uniquement un jeu d'exemples pour les tests ; il
n'est plus lu par le site. Aucun repli automatique sur ce fichier.

Nom prérempli ; événements, navigation et réponses non autorisés masqués.
`Max adultes` et `Max enfants` sont les plafonds par famille, identiques pour chacun
des événements autorisés. Les invités peuvent choisir entre 1 et le maximum d'adultes,
et entre 0 et le maximum d'enfants, ou répondre absent. Avec 2 adultes et 0 enfant,
seuls 1 ou 2 adultes sont proposés ; le choix des enfants est masqué.
Les limites sont obligatoires, contrôlées côté serveur, et acceptent jusqu'à 50 par
catégorie. Pour les anciennes lignes, renseigner explicitement ces deux nouvelles
colonnes ; une limite manquante ferme l'invitation plutôt que d'autoriser trop de monde.
Sans lien, ID inconnu, mauvaise configuration ou serveur inaccessible : programme
et formulaire restent fermés. Si tous les événements sont non, afficher un message
sans formulaire.

## Installer le serveur corrigé

1. Dans le Google Sheets, ouvrir **Extensions → Apps Script**.
2. Remplacer le contenu de `Code.gs` par **apps-script/Code.gs** de cette branche,
   puis enregistrer. Le bon ID de Google Sheets est déjà renseigné.
3. Vérifier les en-têtes de l'onglet **Invités** ci-dessus. Ne pas rendre le tableau public.
4. **Déployer → Gérer les déploiements → Modifier** (crayon), choisir
   **Nouvelle version**, puis **Déployer** sur le déploiement existant.
   Garder l'URL `/exec` déjà utilisée dans `sheet-api.js`.
   Le service doit s'exécuter en tant que propriétaire et être accessible aux invités
   sans connexion Google. Si Google demande une autorisation du propriétaire,
   terminer cette étape dans son compte.
5. Si un nouveau déploiement est créé et que son URL change, remplacer la valeur
   `endpoint` dans `sheet-api.js` par cette nouvelle URL `/exec`.
6. Déployer ensuite la branche du site via le circuit GitHub Pages habituel.
   Les nouvelles fonctionnalités nécessitent **les deux** déploiements.

Ne pas lancer `doPost` avec le bouton Exécuter : il nécessite une requête du site.
Éviter de laisser les anciennes versions actives longtemps après migration : elles
n'ont pas les nouvelles validations. Cette branche n'a modifié aucun déploiement Google
et n'a envoyé aucune réponse réelle.

## Enregistrement et confirmation

Le serveur relit les droits depuis **Invités**, impose le nom du tableau et vérifie
les présences et effectifs. Les événements exclus sont enregistrés `Masqué`, même
si le navigateur tente de les ajouter. Les messages sont limités à 2000 caractères
et les textes commençant comme une formule sont enregistrés comme texte.

Les six colonnes historiques de **Réponses** restent dans le même ordre :
`Date | Nom | Mairie | Houppa | Shabbat | Message`.
Deux colonnes sont ajoutées : **G : ID invité**, **H : ID envoi**.
G et H doivent être libres ou déjà porter ces noms ; sinon le script refuse d'écrire.
Les anciennes lignes sont conservées. Les nouveaux envois modifiés créent de
nouvelles lignes, comme auparavant ; réessayer exactement la même réponse dans
la même page réutilise son ID et ne duplique pas la ligne.

Le POST reste `no-cors`. La confirmation dépend ensuite d'une lecture du reçu
`action=status` : succès uniquement si l'ID d'envoi a été retrouvé pour cet invité.
Sans preuve, le site conserve les champs et annonce que l'enregistrement reste
incertain. Les GET ne font aucune écriture et ne renvoient jamais les messages RSVP.

Les lectures utilisent le JSONP documenté par Google pour ce type de service :
https://developers.google.com/apps-script/guides/content#serving_jsonp_in_web_pages
Les callbacks sont restreints à un format contrôlé et les lectures ont un délai
limité. Le statut n'expose qu'un booléen et un identifiant d'envoi.

Les liens restent partageables : utiliser des ID longs, aléatoires et difficiles à
deviner pour limiter l'accès par devinette. Ce système ne vérifie pas l'identité de
la personne qui possède le lien et ne doit pas servir à héberger des données sensibles.

## Vérifier après déploiement

- Ouvrir un lien avec un **ID existant** : vérifier le nom et les événements.
- Ouvrir le même lien sur téléphone, puis un ID inconnu : aucun événement dans ce dernier cas.
- Répondre avec un foyer de test clairement identifié, puis vérifier dans **Réponses**
  le nom, les événements, l'ID invité et l'ID envoi. Ne conclure à la validation réelle
  qu'après cette vérification sur Google Sheets.
- Cliquer de nouveau sans changer les champs : une seule nouvelle ligne doit exister.
- Vérifier Factory 58, le départ Waze et l'heure 16 h.

## Tests locaux

`npm install` puis `npm test` (Google Chrome installé).
Tests serveur avec doubles de SpreadsheetApp/LockService et tests navigateur avec
réponses Apps Script simulées : aucun accès en écriture au vrai Google Sheets.

Pour une prévisualisation avec le service Google réellement déployé :
`python3 -m http.server 8000`, puis ouvrir
`http://localhost:8000/?invite=UN-ID-EXISTANT`.

## Aperçu local sans déploiement Google

Depuis le dossier du dépôt : `python3 -m http.server 8000 --bind 127.0.0.1`.
Ouvrir http://127.0.0.1:8000/?preview=1&invite=gabriel-arzoin pour les trois événements,
ou http://127.0.0.1:8000/?preview=1&invite=elie-chicha pour la houppa seule.
Ce mode fonctionne uniquement sur localhost, lit les exemples de `guests.json`
et désactive les envois RSVP. Il permet de vérifier l'animation, la présentation et
les événements masqués sans modifier Google Sheets.

Cliquer sur le sceau : le rabat s'ouvre, la carte sort, l'enveloppe s'efface et la
couverture de la carte se déplie. L'invitation apparaît ensuite automatiquement.
Le bouton « Passer » permet d'accéder directement au site.
Retirer `preview=1` et utiliser un ID réel pour tester le service Google déployé.

## Créer les invitations depuis le site

Ouvrir `/admin.html` après déploiement, ou
http://127.0.0.1:8000/admin.html?preview=1 en aperçu local.

La page de gestion propose : nom du foyer, événements à cocher, maximum d'adultes,
maximum d'enfants, puis **Créer l'invitation**, **Copier le lien** et **Voir l'invitation**.
Elle enregistre une nouvelle ligne dans **Invités** en arrière-plan et génère un ID
aléatoire. Il n'est plus nécessaire de remplir manuellement le tableau pour les
nouvelles invitations. La création répétée sans modifier les champs conserve le
même ID pour éviter les doublons. Pour inviter une autre famille, modifier le nom.

Configuration unique avant utilisation réelle :

1. Installer la **dernière version** de `apps-script/Code.gs` et redéployer le service.
2. Dans Apps Script → **Paramètres du projet → Propriétés du script**, ajouter
   `ADMIN_KEY` avec une clé secrète aléatoire d'au moins 32 caractères.
   Choisir et conserver cette clé dans votre gestionnaire de mots de passe ;
   ne pas la mettre dans le dépôt GitHub ni dans un lien d'invitation.
3. Saisir cette clé dans la page de gestion pour créer les invitations.
   Elle est vérifiée côté serveur et envoyée uniquement dans le corps du POST.
   Elle n'est enregistrée ni dans localStorage ni dans les liens générés.
4. Déployer aussi les fichiers du site depuis `correction-ilan`.

La page de gestion est consultable par URL, mais aucune création réelle n'est
possible sans la clé. Le tableau Google Sheets n'a pas besoin d'être public.
Si **Invités** n'existe pas, la première création autorisée le crée ; les colonnes
manquantes sont ajoutées sans supprimer les données existantes.

En aperçu `?preview=1`, accessible uniquement sur localhost, les nouvelles familles
sont conservées dans localStorage du navigateur courant. Leurs liens d'aperçu
fonctionnent dans ce même navigateur et sur ce même ordinateur ; ils ne sont pas
à envoyer aux vrais invités. Aucun appel d'écriture Google n'est effectué et les
réponses RSVP restent désactivées. La clé de gestion n'est pas demandée en aperçu.
