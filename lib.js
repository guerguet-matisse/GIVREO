// © 2026 Matisse Guerguet – Tous droits réservés. Voir le fichier LICENSE.
// Fonctions pures : géométrie, simplification de trace, GPX, CSV, risque de verglas, formats.
(function (root) {
  "use strict";
  const R = 6371000, rad = Math.PI / 180;

  const haversine = (a, b) => {
    const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  const bearing = (a, b) => {
    const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) -
      Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  };

  const cumulative = (line) => {
    const c = new Float64Array(line.length);
    for (let i = 1; i < line.length; i++) c[i] = c[i - 1] + haversine(line[i - 1], line[i]);
    return c;
  };

  // distance d'un point à chaque segment d'une ligne (approximation plane locale, précise à l'échelle d'une ville)
  function segmentsDist(line, p, from, to) {
    const k = Math.cos(p[0] * rad) * R * rad, kk = R * rad;
    const px = p[1] * k, py = p[0] * kk, out = [];
    for (let i = from; i <= to; i++) {
      const ax = line[i][1] * k, ay = line[i][0] * kk, bx = line[i + 1][1] * k, by = line[i + 1][0] * kk;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + t * dx, cy = ay + t * dy;
      out.push({ seg: i, t, dist: Math.hypot(px - cx, py - cy), ll: [cy / kk, cx / k] });
    }
    return out;
  }

  // point le plus proche d'une ligne, en préférant le PREMIER passage quasi optimal (routes parcourues deux fois)
  // minT : sur le segment de départ, on n'accepte que les positions situées après cette fraction (ordre conservé)
  function nearestForward(line, p, from, to, slack, minT) {
    if (line.length < 2) return { seg: 0, t: 0, dist: line.length ? haversine(line[0], p) : Infinity, ll: line[0] || null };
    from = Math.max(0, from | 0); to = Math.min(line.length - 2, to == null ? line.length - 2 : to | 0);
    if (from > to) from = to;
    let all = segmentsDist(line, p, from, to);
    if (minT) { const f = all.filter((s) => s.seg > from || s.t >= minT - 1e-9); if (f.length) all = f; }
    let best = all[0];
    for (const s of all) if (s.dist < best.dist) best = s;
    const lim = best.dist + (slack == null ? 15 : slack);
    for (const s of all) if (s.dist <= lim) return s;
    return best;
  }

  const alongOf = (cum, s) => cum[s.seg] + s.t * (cum[s.seg + 1] - cum[s.seg]);

  // projette des points dans l'ordre sur une ligne (l'ordre des points est conservé le long de la ligne)
  function snapMonotone(points, line) {
    const res = []; let prev = 0, prevT = 0;
    for (const p of points) {
      const s = nearestForward(line, p, prev, line.length - 2, 20, prevT);
      res.push(s); prev = s.seg; prevT = s.t;
    }
    return res;
  }

  // Douglas-Peucker itératif, tolérance en mètres
  function simplify(line, tol) {
    if (line.length < 3) return line.slice();
    const k = Math.cos(line[0][0] * rad) * R * rad, kk = R * rad;
    const xy = line.map((p) => [p[1] * k, p[0] * kk]);
    const keep = new Uint8Array(line.length); keep[0] = keep[line.length - 1] = 1;
    const stack = [[0, line.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = xy[a][0], ay = xy[a][1], dx = xy[b][0] - ax, dy = xy[b][1] - ay, l2 = dx * dx + dy * dy;
      let dmax = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        let t = l2 ? ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(xy[i][0] - (ax + t * dx), xy[i][1] - (ay + t * dy));
        if (d > dmax) { dmax = d; idx = i; }
      }
      if (dmax > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return line.filter((_, i) => keep[i]);
  }

  // ---------- GPX ----------
  const ESC = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" };
  const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ESC[c]);
  const unesc = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");

  function toGPX({ name, wpts = [], trk = [] }) {
    const w = wpts.map((p) => `  <wpt lat="${p.ll[0].toFixed(6)}" lon="${p.ll[1].toFixed(6)}"><name>${esc(p.name)}</name></wpt>`).join("\n");
    const t = trk.length ? `  <trk><name>${esc(name)}</name><trkseg>\n${trk.map((p) =>
      `    <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join("\n")}\n  </trkseg></trk>\n` : "";
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GPS Salage" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `  <metadata><name>${esc(name)}</name></metadata>\n${w}\n${t}</gpx>\n`;
  }

  function parseGPX(txt) {
    const attr = (s, n) => { const m = new RegExp(n + "\\s*=\\s*[\"']([^\"']+)[\"']").exec(s); return m ? parseFloat(m[1]) : NaN; };
    const out = { name: "", wpts: [], rte: [], trk: [] };
    const nm = /<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(txt) || /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(txt);
    if (nm) out.name = unesc(nm[1].trim());
    let m; const reW = /<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g;
    while ((m = reW.exec(txt))) {
      const lat = attr(m[1], "lat"), lon = attr(m[1], "lon"), n = /<name>([\s\S]*?)<\/name>/.exec(m[2]);
      if (isFinite(lat) && isFinite(lon)) out.wpts.push({ ll: [lat, lon], name: n ? unesc(n[1].trim()) : "" });
    }
    const reP = /<(trkpt|rtept)\b([^>]*)>/g;
    while ((m = reP.exec(txt))) {
      const lat = attr(m[2], "lat"), lon = attr(m[2], "lon");
      if (isFinite(lat) && isFinite(lon)) (m[1] === "trkpt" ? out.trk : out.rte).push([lat, lon]);
    }
    return out;
  }

  // ---------- CSV (séparateur ; et BOM : s'ouvre correctement dans Excel en français) ----------
  const toCSV = (rows) => "\ufeff" + rows.map((r) => r.map((v) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(";")).join("\r\n") + "\r\n";

  // ---------- risque de verglas (indicatif, ne remplace pas la vigilance Météo-France) ----------
  function iceRisk(h) {
    const n = Math.min(12, (h.temperature_2m || []).length);
    if (!n) return null;
    let minT = Infinity, minS = Infinity, pluie = 0, heure = null;
    for (let i = 0; i < n; i++) {
      const t = h.temperature_2m[i], s = h.soil_temperature_0cm ? h.soil_temperature_0cm[i] : t;
      if (t < minT) { minT = t; heure = h.time ? h.time[i] : null; }
      if (s != null && s < minS) minS = s;
      pluie += (h.precipitation && h.precipitation[i]) || 0;
    }
    if (!isFinite(minS)) minS = minT;
    const froid = Math.min(minT, minS);
    let niveau = "faible", libelle = "Pas de gel prévu dans les 12 h";
    if (froid <= 0 && pluie >= 0.1) { niveau = "eleve"; libelle = "Verglas probable : salage conseillé"; }
    else if (froid <= 0 || (froid <= 2 && pluie >= 0.1)) { niveau = "moyen"; libelle = "Gel possible : à surveiller"; }
    return { niveau, libelle, minT, minSol: minS, pluie, heure };
  }

  // ---------- formats ----------
  const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : Math.round(m) + " m");
  const fmtDuree = (s) => { const m = Math.round(s / 60); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0"); };
  const fmtHeure = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const api = { haversine, bearing, cumulative, nearestForward, alongOf, snapMonotone, simplify, toGPX, parseGPX,
    toCSV, iceRisk, fmtDist, fmtDuree, fmtHeure, fmtDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Lib = api;
})(typeof self !== "undefined" ? self : this);
