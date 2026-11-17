# Publier et déployer Poksin

## Publier une version

`package.json` fixe la version de l’application. Une étiquette Git `vX.Y.Z` correspondant à cette version, sur un commit de `main`, déclenche les contrôles CI. Une fois `poksin-ci` réussi, GitHub publie sur Docker Hub et joint `poksin-openshift.yaml` à la release GitHub. Le YAML désigne par digest l’image contrôlée que la CI a publiée.

Configurer `DOCKERHUB_USERNAME` dans les variables GitHub Actions et `DOCKERHUB_TOKEN` dans les secrets du dépôt. Utiliser un jeton Docker Hub dédié à la publication avec les autorisations de lecture et d’écriture. La CI publie dans le dépôt Docker Hub `poksin` du compte configuré. [Jetons Docker Hub](https://docs.docker.com/security/access-tokens/personal-access-tokens/)

## Déployer sur OpenShift

Depuis la racine du dépôt, utiliser [le manifeste OpenShift](../k8s/openshift/poksin.yaml). Il référence l’image Docker Hub par digest. Dans une session PowerShell où `oc` est authentifié, renseigner l’URL de l’API du cluster et le namespace de destination.

```powershell
$serveur = Read-Host 'URL de l’API OpenShift'
$projet = Read-Host 'Namespace du projet'
$manifeste = 'k8s/openshift/poksin.yaml'
$registre = (Read-Host 'Nom d’hôte du registre du cluster, ou Entrée pour Docker Hub').Trim()

if ($registre) {
    $image = Select-String -LiteralPath $manifeste -Pattern '^\s+image:\s+docker\.io/(\S+)\s*$'
    $reference = $image.Matches[0].Groups[1].Value
    $yaml = node scripts/render-openshift.mjs "$registre/$reference"
    if ($LASTEXITCODE -ne 0) { throw 'Génération du manifeste impossible.' }
    $manifeste = Join-Path ([IO.Path]::GetTempPath()) 'poksin-openshift-local.yaml'
    $yaml | Set-Content -LiteralPath $manifeste -Encoding utf8
}

oc --server=$serveur --namespace=$projet apply --dry-run=server -f $manifeste
if ($LASTEXITCODE -ne 0) { throw 'Le dry-run OpenShift a échoué.' }
oc --server=$serveur --namespace=$projet apply -f $manifeste
oc --server=$serveur --namespace=$projet rollout status deployment/poksin --timeout=5m
oc --server=$serveur --namespace=$projet get route poksin -o jsonpath='{.spec.host}'
```

Pour utiliser un registre interne, saisir uniquement son nom d’hôte, sans `https://` ni chemin. La commande conserve le chemin de l’image et son digest, puis écrit le manifeste adapté dans le répertoire temporaire du poste.

Ouvrir l’hôte retourné en HTTPS. `GET /healthz` doit répondre `{"ok":true}`. Partager l’adresse HTTPS de la salle pour tester l’invitation sur deux postes. L’application utilise la Route TLS pour les cookies sécurisés et maintient le flux SSE pour synchroniser les votes.

Pour déployer une version publiée, télécharger `poksin-openshift.yaml` depuis la release et utiliser ce fichier comme `$manifeste`. Si le cluster utilise un registre interne, remplacer localement le nom d’hôte sur la ligne `image:` en conservant le chemin de l’image et son digest.

Si le dépôt Docker Hub est privé, créer un secret de pull dans le namespace avec un accès en lecture. Lier ce secret au compte de service `poksin` avec `oc --server=$serveur --namespace=$projet secrets link poksin poksin-dockerhub --for=pull`, puis relancer le déploiement. Utiliser un jeton de pull distinct du jeton de publication GitHub Actions. [Registres privés OpenShift](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/images/managing-images)

## Stockage et mise à jour

Le pod réserve `1m` de CPU et `128Mi` de mémoire. Sa limite mémoire est de `384Mi`. La `LimitRange` du projet peut fixer une limite CPU par défaut.

Le manifeste crée le volume `poksin-data` de 1 Gio avec la classe RWO par défaut du projet. Le déploiement utilise un seul pod et la stratégie `Recreate`. Chaque mise à jour interrompt brièvement la connexion et réutilise la base SQLite du PVC. Les navigateurs se reconnectent au démarrage du nouveau pod. Conserver le PVC lors d’une mise à jour ou d’un redéploiement. Sauvegarder la base suivant [le guide d’exploitation](exploitation.md) avant une mise à jour qui change le schéma.

Pour revenir à une version, appliquer le manifeste de cette release après avoir vérifié sa compatibilité avec le schéma de la base. La CI réutilise le manifeste du dépôt avec `node scripts/render-openshift.mjs IMAGE@sha256:DIGEST` pour y inscrire le digest de chaque nouvelle version.
