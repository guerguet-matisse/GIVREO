<div align="center">

# 🧂 GPS Salage

**Guidage GPS du circuit de salage – Itinéraire n°3 (Soissons)**

Voies prioritaires → voies secondaires · points numérotés · noms de rue · hors-ligne

![PWA](https://img.shields.io/badge/PWA-installable-3ea8ff)
![Open source](https://img.shields.io/badge/100%25-open%20source-5be39a)
![Sans build](https://img.shields.io/badge/HTML%20%2B%20JS-sans%20framework-ff5a4d)

</div>

---

## ✨ Fonctionnalités

| | |
|---|---|
| 🔴 **Voies prioritaires** | 26 points, suivis dans l'ordre du plan |
| 🔵 **Voies secondaires** | 44 points, enchaînés automatiquement après le principal |
| 📍 **Guidage** | rue du prochain point, distance, flèche de direction |
| ✅ **Validation auto** | le point suivant s'active à moins de 35 m |
| 🔊 **Voix** | annonce vocale en français de chaque point |
| 📴 **Hors-ligne** | l'app et les tuiles de carte déjà vues sont mises en cache |
| ✏️ **Éditeur** | déplace les points, renomme les rues, exporte en JSON |

## 🧱 Technologies (toutes open source)

[Leaflet](https://leafletjs.com) · [OpenStreetMap](https://www.openstreetmap.org) · [OSRM](https://project-osrm.org) · HTML / CSS / JavaScript pur

## 🚀 Démarrage rapide

### Tester sur ton PC

```bash
cd gps-salage
python -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

### Installer sur ton téléphone

> Le GPS exige du **HTTPS**. GitHub Pages en fournit gratuitement.

1. Crée un dépôt GitHub (par ex. `gps-salage`) et place ces fichiers à la racine.
2. **Settings → Pages** → branche `main`, dossier `/ (root)`.
3. Ouvre `https://TON-PSEUDO.github.io/gps-salage/` sur le téléphone.
4. Installe l'app :
   - **Android (Chrome)** : menu ⋮ → *Installer l'application*
   - **iPhone (Safari)** : Partager → *Sur l'écran d'accueil*
5. Autorise la localisation, et ouvre l'app une fois avec du réseau pour mettre la carte en cache.

## 🕹️ Utilisation

| Bouton | Action |
|---|---|
| **Démarrer** | active / coupe le GPS |
| **◀ Précédent · Suivant ▶** | change de point à la main (toucher un numéro sur la carte marche aussi) |
| **Suivre** | la carte reste centrée sur ta position |
| **Voix** | active l'annonce vocale |
| **Caler** | à faire en premier : tu touches sur la carte 3 repères (début du circuit, rond-point des États-Unis, pont vers Pasly). Le circuit se recale (décalage, rotation, échelle) puis s'aligne sur les rues |
| **Routes** | relance l'alignement des points et des tracés sur les vraies rues (internet requis, fait automatiquement au 1er lancement) |
| **Voies secondaires / prioritaires** | bascule d'un itinéraire à l'autre |
| **Éditer** | glisser un point = le déplacer · le toucher = renommer la rue |
| **Exporter** | télécharge tes corrections (`itineraire3-salage.json`) |
| **Réinit.** | efface corrections et progression |

## ⚠️ Précision des points

Les points ont été **relevés sur des photos de plans papier**, puis convertis en GPS : ils sont approximatifs, et beaucoup de voies secondaires s'appellent encore « Voie secondaire ».

👉 Fais un premier passage en mode **Éditer** pour recaler les points et nommer les rues.
Tu peux aussi modifier la liste des points et le calage (`CALAGE`) directement dans `data.js`.

## 📁 Fichiers

```
gps-salage/
├── index.html            interface + logique de guidage
├── data.js               points des deux itinéraires + calage GPS
├── sw.js                 service worker (hors-ligne)
├── manifest.webmanifest  installation sur téléphone
└── icon.svg              icône de l'app
```

## 📜 Licences

Code : libre d'utilisation. Cartes : © contributeurs d'[OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
