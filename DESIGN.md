# Interface Poksin

Poksin privilégie le sujet actif, les personnes présentes et le choix d’une carte. Le vocabulaire de la salle correspond à l’atelier. L’animateur voit les actions de préparation et de décision au même endroit que les votes.

## Identité

Fond ivoire, encre prune, violet franc pour l’action et touches safran et menthe pour les états utiles. Les cartes ont leur propre dos dessiné en CSS, avec un motif géométrique cohérent avec le symbole de Poksin. Le texte de navigation et les nombres des cartes forment deux niveaux visuels facilement repérables. Les libellés et couleurs des cartes sont modifiables depuis les réglages de la salle.

DM Sans sert aux libellés et à la lecture. Bricolage Grotesque donne du caractère aux titres et aux cartes. Les polices sont servies avec le build et la licence des dépendances est publiée sous `/assets/licences.txt`.

## Salle

Sur grand écran, le centre rassemble le sujet en cours, les participants et les cartes. La file reste disponible en parallèle. Sur mobile, la session s’organise en une colonne et les groupes de cartes peuvent s’enrouler. Le contrôle Tickets/Libre et l’ajout de ticket sont accessibles depuis la session.

Le changement d’état doit rester perceptible sans le mouvement. Utiliser des libellés, des états sélectionnés et l’indication du vote en plus de la couleur. La révélation anime les cartes et respecte `prefers-reduced-motion`. Les champs, dialogues et boutons restent utilisables au clavier et préservent le focus.
