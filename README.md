<div align="center">

# 🧂 GPS Salage

**Le guidage GPS du circuit de salage – Itinéraire n°3 (Soissons)**

Voies prioritaires, puis voies secondaires · points numérotés · noms de rues

### 👉 [Ouvrir l'application](https://guerguet-matisse.github.io/GPS-salage/) 👈

![Gratuit](https://img.shields.io/badge/gratuit-oui-5be39a)
![Sans installation](https://img.shields.io/badge/installation-depuis%20le%20navigateur-3ea8ff)
![Open source](https://img.shields.io/badge/open%20source-oui-ff5a4d)

</div>

---

## 📱 Installer l'application sur ton téléphone

Ouvre ce lien sur ton téléphone : **https://guerguet-matisse.github.io/GPS-salage/**

| Téléphone | Comment faire |
|---|---|
| **Android** (Chrome) | Menu **⋮** en haut à droite → **Installer l'application** |
| **iPhone** (Safari) | Bouton **Partager** → **Sur l'écran d'accueil** |

L'icône **GPS Salage** apparaît alors avec tes autres applications.

> 💡 Ouvre l'application une première fois **avec du réseau** : la carte se met en mémoire et fonctionne ensuite même si la connexion est mauvaise.

---

## 🧭 Premier lancement : caler le circuit (1 minute)

Les points du circuit viennent d'un plan papier. Pour qu'ils tombent bien sur les rues, il faut un petit calage à faire **une seule fois** :

1. Appuie sur **Caler**.
2. Touche sur la carte l'endroit de chaque repère demandé :
   1. le **point n°1** : début du circuit, sur l'avenue de Coucy ;
   2. le **rond-point des États-Unis** (point n°6) ;
   3. le **pont sur l'Aisne vers Pasly** (point n°12).
3. L'application recale tout le circuit et le colle sur les rues. Attends le message de confirmation.

Si les tracés restent en pointillés, appuie sur **Routes** (il faut du réseau).

---

## 🚚 Utiliser le guidage

1. Appuie sur **Démarrer** et autorise la localisation.
2. L'écran du haut indique la **rue**, le **numéro du point**, la **distance** et la **direction** à suivre.
3. À moins de 35 m du point, l'application passe **automatiquement** au suivant.
4. Après le dernier point des voies prioritaires, elle enchaîne sur les **voies secondaires**.

### Les boutons

| Bouton | À quoi il sert |
|---|---|
| **Démarrer / Arrêter** | active ou coupe le GPS |
| **◀ Précédent · Suivant ▶** | change de point à la main (toucher un numéro sur la carte marche aussi) |
| **Suivre** | garde la carte centrée sur ta position |
| **Voix** | annonce chaque point à voix haute, en français |
| **Caler** | recale le circuit sur la carte (voir plus haut) |
| **Routes** | colle les points et les tracés sur les vraies rues (réseau nécessaire) |
| **Voies secondaires / prioritaires** | passe d'un itinéraire à l'autre |
| **Éditer** | glisse un point pour le corriger, touche-le pour renommer la rue |
| **Exporter** | enregistre tes corrections dans un fichier |
| **Réinit.** | efface le calage, les corrections et la progression |

Sur la carte : 🔴 voies prioritaires, 🔵 voies secondaires, 🔵 gros point bleu = ta position.

---

## ✏️ Corriger un point

Un point est mal placé ou une rue porte un mauvais nom ?

1. Appuie sur **Éditer**.
2. **Glisse** le point à la bonne place, ou **touche-le** pour changer le nom de la rue.
3. Appuie de nouveau sur **Éditer** pour terminer.

Tes corrections restent enregistrées sur ton téléphone.

---

## ❓ Problèmes fréquents

| Problème | Solution |
|---|---|
| Le GPS ne démarre pas | Autorise la localisation pour le site dans les réglages du navigateur |
| La carte reste grise | Vérifie ta connexion, puis recharge la page |
| Les tracés sont en pointillés | Appuie sur **Routes** avec du réseau |
| Les points sont décalés | Refais le calage avec **Caler** |
| L'ancienne version s'affiche | Ferme complètement l'application, puis rouvre-la |

---

## ⚠️ À savoir

- Les positions viennent de photos de plans : elles sont **approximatives** tant que le calage n'est pas fait, et certaines voies secondaires portent un nom générique.
- Cette application est une **aide à la navigation** : respecte toujours le code de la route et la signalisation.

---

## 🛠️ Pour les développeurs

Application web (PWA) en HTML / JavaScript pur, sans framework ni étape de build.
Technologies open source : [Leaflet](https://leafletjs.com) · [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) · [OSRM](https://project-osrm.org).

```
gps-salage/
├── index.html            interface et logique de guidage
├── data.js               points des deux itinéraires et calage GPS
├── sw.js                 service worker (mode hors-ligne)
├── manifest.webmanifest  installation sur téléphone
└── icon.svg              icône
```

Tester en local : `python -m http.server 8000`, puis ouvre <http://localhost:8000>.
Déploiement : GitHub Pages, branche `main`, dossier `/ (root)`.
