# E-mails envoyés par Eagle Touch

Ces textes se collent dans Supabase : **Authentication > Emails > Templates**.
Pour chaque modèle, collez le sujet dans « Subject » et le contenu du fichier dans « Body », puis enregistrez.

| Modèle dans Supabase | Sujet | Fichier |
|---|---|---|
| Confirm signup | Confirmez votre compte Eagle Touch | `confirmation-inscription.html` |
| Reset password | Votre code Eagle Touch | `mot-de-passe-oublie.html` |
| Change email address | Confirmez votre nouvelle adresse e-mail | `changement-adresse.html` |

Important : le modèle « Reset password » doit contenir `{{ .Token }}`. C'est le code que le joueur
saisit dans l'application ; sans lui, le mot de passe oublié ne fonctionne pas.
