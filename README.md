# Carte de mariage Eden & Ilan

Site statique, hébergé sur GitHub Pages. Branche de corrections : `correction-ilan`.
La houppa a lieu le 18 février 2027 à 16 h, heure de Paris, à Factory 58,
12 rue Gutenberg, 93000 Bobigny.

## Invitations personnelles

Envoyer un lien par foyer avec le paramètre `invite`, correspondant exactement à
une clé de `guests.json` :

- Ilan : https://mariage-eden-ilan.com/?invite=ilan-dahan
- Gabriel : https://mariage-eden-ilan.com/?invite=gabriel-arzoin
- Élie : https://mariage-eden-ilan.com/?invite=elie-chicha
- Michael : https://mariage-eden-ilan.com/?invite=michael-dahan

Ces liens ne refléteront les corrections qu'après leur déploiement.
Michael a actuellement les trois événements à `false` : son lien affichera un
message sans programme ni formulaire. Modifier ses autorisations si nécessaire.

Pour ajouter un invité, ajouter une entrée JSON de cette forme (clé unique,
sans espaces, conserver les virgules entre les entrées) :

```json
"famille-exemple": {
  "nom": "Famille Exemple",
  "mairie": true,
  "houppa": true,
  "shabbat": false
}
```

`true` affiche l'événement, son bouton de navigation et sa réponse RSVP.
`false` les masque et désactive les champs correspondants. Les réponses exclues
sont envoyées avec la valeur `Masqué`, pour conserver le format du formulaire.
Le nom est prérempli et l'identifiant est ajouté au champ `invite` du POST.
Un lien absent, inconnu ou un échec de chargement n'ouvre pas le programme.

Cette personnalisation n'est pas une authentification : le dépôt et le fichier
JSON sont publics, les liens sont partageables et le navigateur peut être modifié.
Pour des invitations confidentielles ou une validation stricte des réponses,
conserver les invités côté serveur et y vérifier leurs droits.

## Réponses Google Sheets

Le serveur Google Apps Script n'est pas présent dans ce dépôt. L'envoi actuel
utilise `no-cors` : le navigateur ne peut pas lire sa réponse ni certifier
l'enregistrement. Le message affiche donc « envoyée », sans promettre une
sauvegarde vérifiée, et les champs sont conservés.

Pour confirmer l'enregistrement de bout en bout, il faut le code et l'accès au
déploiement Apps Script : vérifier les droits de l'invité côté serveur, enregistrer
la réponse et fournir un accusé de réception lisible par le site (via un endpoint
avec CORS adapté ou un relais). Aucun RSVP réel n'est envoyé par les tests.

## Vérification locale

Servir le dossier via HTTP, par exemple `python3 -m http.server 8000`, puis ouvrir
`http://localhost:8000/?invite=ilan-dahan`. Ne pas ouvrir directement le HTML en
`file://`, car le chargement JSON nécessite HTTP.

Les tests Playwright couvrent les quatre invités, les liens invalides, les erreurs
de chargement, les réponses masquées, les calendriers et l'ouverture de l'enveloppe
sur mobile et ordinateur. Lancer `npm install`, puis `npm test` (Google Chrome doit être installé).
