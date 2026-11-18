# Versions de Poksin

## 0.2.0

- Ouvrir une même salle à son adresse directe ou derrière un reverse proxy avec préfixe, en conservant les invitations, les votes en direct et la reconnexion.
- Conserver la configuration de l’adresse publique supplémentaire lors des mises à jour OpenShift, avec l’accès à la racine par défaut.

## 0.1.0

- Salles d’estimation par lien, votes privés, révélation et personnalisation des cartes.
- Ajout de tickets en cours de vote et bascule Tickets/Libre avec reprise de la manche et du brouillon.
- Persistance SQLite et reconnexion automatique. Tests de production multijoueurs et de redémarrage.
- Image Docker Hub versionnée et manifeste OpenShift épinglé au digest de l’image vérifiée.
