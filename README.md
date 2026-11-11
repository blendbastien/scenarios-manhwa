# Scénarios — `scenarios-manhwa`

Scénarios et missions façon « fenêtre système » : outil MJ, calque joueur, journal, objectifs, récompenses.

Code de la version **2.0.1** (dernière release), pour Foundry VTT v13.

## Liens avec la suite Manhwa

La suite compte un système (Fiche - Manhwa) et 11 modules. La Fiche est le centre : les données partagées y vivent et les modules les lisent via `globalThis.MANHWA`.

- Utilise la Boutique (récompenses), la Carte Stellaire (lieux), les Notifications et `MANHWA.config` ; écoute `manhwaGmGroups`.
- Règle commune : un module ne plante jamais si un autre est absent (vérifier `game.modules.get(id)?.active` avant d'appeler son API).

## Livraison

1. Augmenter `version` dans `module.json` (jamais deux livraisons au même numéro).
2. Construire le zip, qui doit contenir le dossier `scenarios-manhwa/` :
   ```bash
   mkdir -p build/scenarios-manhwa && git archive HEAD | tar -x -C build/scenarios-manhwa
   cd build && zip -qr scenarios-manhwa.zip scenarios-manhwa
   ```
3. Créer la release GitHub `vX.Y.Z` avec **exactement 2 fichiers** : `module.json` et `scenarios-manhwa.zip`. Le manifeste pointe vers `releases/latest/download/…`.
4. The Forge : Bazaar → *Install From Manifest* avec l'URL versionnée `https://github.com/blendbastien/scenarios-manhwa/releases/download/vX.Y.Z/module.json`. Ne jamais utiliser *Update All Packages*.
5. Redémarrer le monde de test, vérifier la version installée et tester.
