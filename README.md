# Carte de mariage Eden & Ilan

Branche : `correction-ilan`. Houppa le 18 février 2027 à **16 h, heure de Paris**,
à **Factory 58, 12 rue Gutenberg, 93000 Bobigny**. Compteur, Waze et calendrier alignés.

## Source des invités

L'onglet **Invités** du Google Sheets est désormais la source utilisée par le site :
https://docs.google.com/spreadsheets/d/1rpb6pRC_cQ3_3dYrnFl5WKfFRMgX2KYeFcqdhgQYJxE/edit

Première ligne : `ID | Nom | Mairie | Houppa | Shabbat`.
Une ligne par foyer. Chaque ID doit être unique. Autorisations : `oui` / `non`
(les cases à cocher booléennes fonctionnent aussi ; une cellule vide vaut non).
Exemple à adapter dans le tableau, sans remplacer les invités existants :

| ID | Nom | Mairie | Houppa | Shabbat |
| --- | --- | --- | --- | --- |
| famille-exemple | Famille Exemple | non | oui | non |

Lien : `https://mariage-eden-ilan.com/?invite=famille-exemple`.
Les anciens liens `?id=famille-exemple` fonctionnent aussi. Utiliser les ID réels
du tableau : `ilan-dahan` a renvoyé `not found` lors du test de lecture de l'ancien service.
Le fichier `guests.json` reste uniquement un jeu d'exemples pour les tests ; il
n'est plus lu par le site. Aucun repli automatique sur ce fichier.

Nom prérempli ; événements, navigation et réponses non autorisés masqués.
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
