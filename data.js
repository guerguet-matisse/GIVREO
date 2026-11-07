// © 2026 Matisse Guerguet – Tous droits réservés. Voir le fichier LICENSE.
// Itinéraire n°3 – circuit de salage (Soissons)
// Les points ont été relevés en pixels sur les photos des deux plans, puis convertis en GPS
// avec le calage ci-dessous. Ce sont des POSITIONS APPROXIMATIVES : ajuste-les avec le mode
// « Éditer » de l'app (glisser les points, toucher un point pour le renommer).
//
// Format d'un point : [numéro (ou null pour un point de passage), x, y, "nom de rue"]

const CALAGE = {
  // pixel de référence (≈ place Mantoue / centre-ville) -> coordonnées GPS
  refX: 570, refY: 1255, refLat: 49.3817, refLon: 3.3236,
  metresParPixel: 2.2,
  // Sur les plans : le nord est vers la droite de l'image, l'est vers le bas.
};

function pixelVersGps(x, y) {
  const m = CALAGE.metresParPixel;
  const lat = CALAGE.refLat + ((x - CALAGE.refX) * m) / 111320;
  const lon = CALAGE.refLon + ((y - CALAGE.refY) * m) / (111320 * Math.cos((CALAGE.refLat * Math.PI) / 180));
  return [lat, lon];
}

const ITINERAIRES = [
  {
    id: "principal",
    titre: "Voies prioritaires",
    couleur: "#ff5a4d",
    points: [
      [1, 965, 1465, "Avenue de Coucy – début du circuit de salage"],
      [2, 862, 1428, "Boulevard de Laon"],
      [3, 780, 1363, "Pont sur l'Aisne"],
      [4, 697, 1377, "Quai de l'Aisne"],
      [5, 616, 1409, "Boulevard Gambetta"],
      [null, 300, 1330, "Rond-point des États-Unis"],
      [6, 285, 1262, "Rond-point des États-Unis – boulevard Jeanne d'Arc"],
      [null, 255, 1100, "Boulevard Jeanne d'Arc"],
      [6, 606, 1073, "Boulevard Jeanne d'Arc"],
      [7, 671, 997, "Avenue de Compiègne"],
      [null, 660, 150, "Limite Mercin-et-Vaux (demi-tour)"],
      [null, 640, 600, "Carrefour de l'Europe"],
      [10, 712, 612, "Carrefour de l'Europe"],
      [8, 690, 665, "Sortie du carrefour de l'Europe"],
      [9, 860, 740, "Liaison vers l'avenue Poincaré"],
      [11, 1090, 720, "Avenue Poincaré"],
      [null, 1160, 632, "Avenue Poincaré"],
      [12, 1240, 632, "Pont vers Pasly (RD 914)"],
      [null, 1300, 630, "Pasly – demi-tour"],
      [13, 1180, 780, "Boulevard Édouard Branly"],
      [14, 1223, 1000, "Boulevard Branly"],
      [null, 1175, 1020, "Rond-point Branly"],
      [15, 1160, 1120, "Boulevard Henri Martin"],
      [16, 1043, 1303, "Avenue du Mail"],
      [17, 967, 1237, "Boulevard Alexandre Dumas"],
      [18, 985, 1088, "Boulevard Alexandre Dumas"],
      [19, 940, 1020, "Rond-point Pasteur / Dumas"],
      [20, 967, 925, "Rue Henri Salleron"],
      [null, 910, 910, "Place Lamartine"],
      [21, 920, 838, "Avenue Poincaré – Place Lamartine"],
      [22, 990, 810, "Rue Poincaré"],
      [23, 870, 935, "Place Lamartine"],
      [24, 728, 1022, "Rue Saint-Christophe"],
      [25, 840, 1066, "Boulevard Pasteur"],
      [26, 1040, 1000, "Boulevard Victor Hugo – fin du principal"],
    ],
  },
  {
    id: "secondaire",
    titre: "Voies secondaires",
    couleur: "#3ea8ff",
    points: [
      [1, 1040, 1125, "Boulevard Victor Hugo – début du circuit secondaire"],
      [2, 985, 1262, "Boulevard Alexandre Dumas"],
      [3, 1196, 1328, "Avenue du Mail (vers la passerelle)"],
      [4, 1062, 1228, "Voie secondaire"],
      [5, 985, 1310, "Avenue du Mail"],
      [6, 1083, 1270, "Voie secondaire"],
      [7, 1100, 1292, "Voie secondaire"],
      [8, 1115, 1200, "Voie secondaire"],
      [9, 1130, 1155, "Boulevard Henri Martin"],
      [10, 970, 1157, "Rue Macherez"],
      [11, 1228, 1070, "Boulevard Victor Hugo"],
      [12, 1110, 1030, "Voie secondaire"],
      [13, 1075, 923, "Voie secondaire"],
      [14, 1140, 975, "Boulevard Branly"],
      [15, 1130, 910, "Voie secondaire"],
      [16, 1105, 787, "Boulevard Édouard Branly"],
      [17, 1137, 872, "Voie secondaire"],
      [18, 1140, 790, "Boulevard Édouard Branly"],
      [19, 1073, 828, "Voie secondaire"],
      [20, 1045, 888, "Voie secondaire"],
      [21, 980, 1048, "Voie secondaire"],
      [22, 1030, 1050, "Voie secondaire"],
      [23, 1010, 997, "Voie secondaire"],
      [24, 918, 1043, "Boulevard Pasteur"],
      [25, 950, 1037, "Voie secondaire"],
      [26, 1007, 885, "Voie secondaire"],
      [27, 952, 857, "Avenue du Dr Marchand"],
      [28, 968, 785, "Rue Poincaré"],
      [29, 668, 716, "Rue au nord du cimetière"],
      [30, 703, 1018, "Rue au sud de l'avenue de Compiègne"],
      [31, 670, 1082, "Rue Saint-Christophe"],
      [32, 845, 970, "Voie secondaire"],
      [33, 655, 808, "Voie secondaire"],
      [34, 845, 912, "Voie secondaire"],
      [35, 828, 982, "Voie secondaire"],
      [36, 815, 863, "Voie secondaire"],
      [37, 722, 787, "Voie secondaire"],
      [38, 737, 880, "Voie secondaire"],
      [39, 740, 1007, "Voie secondaire"],
      [40, 790, 1018, "Voie secondaire"],
      [41, 775, 915, "Voie secondaire"],
      [42, 772, 778, "Voie secondaire"],
      [43, 782, 830, "Voie secondaire"],
      [44, 700, 740, "Voie secondaire"],
    ],
  },
];
