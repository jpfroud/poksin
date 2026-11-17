# Parcours Poksin

L’animateur crée une salle et partage le lien. Les participants choisissent un nom et rejoignent la salle. Chacun peut sélectionner une carte en privé. L’animateur révèle les cartes au groupe, mène la discussion et enregistre la valeur retenue. [Parcours public TeamRetro](https://planning-poker.teamretro.com/faq/)

La création, la participation et la reprise se font sans compte. La salle expire 90 jours après la dernière activité. [Conservation TeamRetro](https://help.teamretro.com/article/463-planning-poker-privacy-security)

## Critères d’acceptation du premier parcours

1. Un animateur crée une salle et un invité la rejoint depuis un autre navigateur. Les deux voient la présence et le sujet courant.
2. L’invité peut changer son vote avant révélation. L’animateur et les autres participants voient son état de vote. Leurs réponses serveur excluent sa valeur jusqu’à la révélation.
3. L’animateur ajoute un ticket à la file depuis la salle pendant que la manche continue. Un titre suffit et la référence est facultative. Les cartes déjà choisies et l’élément courant restent disponibles.
4. L’animateur bascule sur **Libre** depuis la salle. Un sujet discuté à l’oral peut recevoir une estimation et une note facultative. En revenant sur **Tickets**, l’équipe retrouve la file et les estimations.
5. L’animateur enregistre la valeur retenue et peut lancer une nouvelle manche. Les invités ne peuvent pas révéler les votes ni décider de la valeur retenue.
6. Un participant qui recharge la page récupère sa place et l’état de la manche. La reconnexion conserve les droits associés à sa place.
7. L’animateur choisit un jeu de cartes. La personnalisation permet de modifier des valeurs, des libellés et l’apparence des cartes, avec aperçu.
8. Les actions de vote, d’ajout et de bascule restent accessibles au clavier et sur mobile. La révélation est animée et s’affiche sans mouvement pour les personnes qui le demandent.

Les textes, couleurs, cartes, animations et éléments de marque seront conçus pour Poksin. Le site de référence sert à comprendre le déroulement d’une estimation collaborative.

## Recette de production

`npm run build` puis `npm run test:e2e` rejouent les parcours sur un serveur isolé. Les scénarios ouvrent plusieurs contextes de navigateur pour tester l’invitation, les droits, la révélation manuelle et automatique, l’observation et l’arrivée tardive. Ils couvrent aussi la reprise après une vraie coupure du serveur avec SQLite, les brouillons lors d’une bascule de mode, les liens invalides et le clavier à 320 px. Les écrans principaux font l’objet de contrôles automatisés axe.
