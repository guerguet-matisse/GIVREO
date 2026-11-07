// © 2026 Matisse Guerguet – Tous droits réservés. Voir le fichier LICENSE.
(() => {
  "use strict";
  const G = Lib;
  const $ = (id) => document.getElementById(id);
  const CLE = "gps-salage-v3";
  const COULEURS = ["#ff5a4d", "#3ea8ff", "#5be39a", "#ffb020"];
  const SOISSONS = [49.3817, 3.3236];

  // =====================================================================================
  // État (sauvegardé dans le téléphone, écriture différée pour rester fluide)
  // =====================================================================================
  const defaut = () => ({ tournee: "n3", part: 0, idx: {}, edits: {}, sn: {}, nm: {}, geo: {}, traces: {}, calage: null,
    imports: [], journal: [], session: null, meteo: null,
    reg: { theme: "auto", echelle: 1, voix: false, rayon: 35, vitesse: 25 } });
  let etat = defaut();
  try {
    const s = JSON.parse(localStorage.getItem(CLE) || "null");
    if (s) etat = Object.assign(defaut(), s, { reg: Object.assign(defaut().reg, s.reg || {}) });
    else { const v2 = JSON.parse(localStorage.getItem("gps-salage-v2") || "null"); if (v2 && v2.calage) etat.calage = v2.calage; }
  } catch (e) { /* stockage indisponible : on continue avec l'état par défaut */ }
  let tSave;
  const sauver = () => { clearTimeout(tSave); tSave = setTimeout(() => {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { toast("Stockage plein : exporte tes données puis réinitialise."); } }, 400); };
  const txt = (el, s) => { if (el.textContent !== s) el.textContent = s; };

  // =====================================================================================
  // Conversion plan papier -> GPS (calage : décalage + rotation + échelle)
  // =====================================================================================
  const M = CALAGE.metresParPixel, LAT0 = CALAGE.refLat, LON0 = CALAGE.refLon;
  const MLAT = 111320, MLON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
  const pxVersM = (x, y) => [(y - CALAGE.refY) * M, (x - CALAGE.refX) * M];
  const mVersGps = (e, n) => [LAT0 + n / MLAT, LON0 + e / MLON];
  const gpsVersM = (ll) => [(ll[1] - LON0) * MLON, (ll[0] - LAT0) * MLAT];
  function brutPx(p) {
    let [e, n] = pxVersM(p[1], p[2]);
    if (etat.calage) { const { a, b } = etat.calage;
      const re = a[0] * e - a[1] * n + b[0], im = a[0] * n + a[1] * e + b[1]; e = re; n = im; }
    return mVersGps(e, n);
  }
  const generique = (nom) => /^(Voie secondaire|Rue au|Liaison)/.test(nom);

  // =====================================================================================
  // Tournées, parties (voies prioritaires / secondaires…), points
  // =====================================================================================
  const tournees = () => [{ id: "n3", titre: "Itinéraire n°3 – Soissons", parts: ITINERAIRES.map((i) => i.id) },
    ...etat.imports.map((t) => ({ id: t.id, titre: t.titre, parts: t.parts.map((p) => p.id) }))];
  const tourneeCourante = () => tournees().find((t) => t.id === etat.tournee) || tournees()[0];
  function infoPart(id) {
    const it = ITINERAIRES.find((i) => i.id === id);
    if (it) return { id, titre: it.titre, couleur: it.couleur, integre: true, src: it.points };
    for (const t of etat.imports) { const p = t.parts.find((x) => x.id === id);
      if (p) return { id, titre: p.titre, couleur: p.couleur, integre: false, src: p.points }; }
    return { id, titre: "?", couleur: COULEURS[0], integre: false, src: [] };
  }
  function brutDe(id, i) {
    const info = infoPart(id), p = info.src[i];
    return info.integre ? { num: p[0], nom: p[3], ll: brutPx(p) } : { num: p.num, nom: p.nom, ll: [p.lat, p.lon] };
  }

  const pts = {}, derive = {}, suiviSeg = {};
  function invalider(id) { delete derive[id]; suiviSeg[id] = 0; }
  function construirePts(id) {
    pts[id] = infoPart(id).src.map((_, i) => {
      const b = brutDe(id, i), e = etat.edits[id + ":" + i] || {};
      const al = etat.sn[id] && etat.sn[id][i], nr = etat.nm[id] && etat.nm[id][i];
      return { num: b.num, ll: e.ll || al || b.ll, nom: e.nom || (infoPart(id).integre && generique(b.nom) && nr ? nr : b.nom) };
    });
    invalider(id);
  }
  // géométrie d'une partie : trace enregistrée > tracé routier OSRM > lignes droites entre les points
  function deriveDe(id) {
    if (derive[id]) return derive[id];
    const p = pts[id], line = etat.traces[id] || etat.geo[id] || p.map((q) => q.ll);
    const cum = G.cumulative(line), sn = G.snapMonotone(p.map((q) => q.ll), line);
    return (derive[id] = { line, cum, along: sn.map((s) => G.alongOf(cum, s)), total: cum[cum.length - 1] });
  }
  const partId = () => tourneeCourante().parts[etat.part] || tourneeCourante().parts[0];
  const idxCur = () => etat.idx[partId()] || 0;
  const cible = () => pts[partId()][idxCur()];

  // =====================================================================================
  // Carte (rendu canvas : fluide même avec des milliers de sommets)
  // =====================================================================================
  const map = L.map("map", { zoomControl: false, preferCanvas: true, zoomSnap: 0.5, zoomDelta: 0.5 }).setView(SOISSONS, 14);
  map.attributionControl.setPrefix(false);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, updateWhenIdle: true, keepBuffer: 3,
    attribution: "© contributeurs d'OpenStreetMap" }).addTo(map);
  const gTraces = L.layerGroup().addTo(map), gMarq = L.layerGroup().addTo(map);
  let marq = {}, editMode = false, suivre = true, posMarker = null, precCercle = null;

  function dessinerTraces() {
    gTraces.clearLayers();
    tourneeCourante().parts.forEach((id) => {
      const info = infoPart(id), d = deriveDe(id), cur = id === partId(), reel = !!(etat.traces[id] || etat.geo[id]);
      const o = { interactive: false, lineCap: "round", lineJoin: "round" };
      L.polyline(d.line, { ...o, color: "#fff", weight: cur ? 10 : 7, opacity: cur ? 0.5 : 0.2 }).addTo(gTraces);
      L.polyline(d.line, { ...o, color: info.couleur, weight: cur ? 6 : 4, opacity: cur ? 0.95 : 0.5, dashArray: reel ? null : "8 8" }).addTo(gTraces);
    });
  }
  function classePt(id, i) {
    const t = tourneeCourante(), p = pts[id][i], k = t.parts.indexOf(id);
    const fait = k < etat.part || (k === etat.part && i < idxCur());
    return ["pt", p.num === null ? "via" : "", fait ? "fait" : "", id === partId() && i === idxCur() ? "cible" : ""].join(" ").replace(/\s+/g, " ").trim();
  }
  function iconePt(id, i, cls) {
    const via = pts[id][i].num === null;
    return L.divIcon({ className: "", iconSize: via ? [10, 10] : [28, 28], iconAnchor: via ? [5, 5] : [14, 14],
      html: `<div class="${cls}" style="background:${infoPart(id).couleur}">${via ? "" : pts[id][i].num}</div>` });
  }
  let tAlign;
  function dessinerMarqueurs() {
    gMarq.clearLayers(); marq = {};
    tourneeCourante().parts.forEach((id) => {
      marq[id] = pts[id].map((p, i) => {
        const cls = classePt(id, i);
        const m = L.marker(p.ll, { icon: iconePt(id, i, cls), draggable: editMode, keyboard: false,
          zIndexOffset: id === partId() ? 500 : 0 }).addTo(gMarq);
        m._cls = cls;
        m.bindTooltip((p.num !== null ? "n°" + p.num + " · " : "") + p.nom);
        m.on("dragend", () => { const ll = m.getLatLng(); p.ll = [ll.lat, ll.lng];
          etat.edits[id + ":" + i] = Object.assign(etat.edits[id + ":" + i] || {}, { ll: p.ll });
          invalider(id); sauver(); dessinerTraces(); clearTimeout(tAlign); tAlign = setTimeout(() => aligner(true), 900); });
        m.on("click", () => {
          if (editMode) { const n = prompt("Nom de la rue pour ce point :", p.nom);
            if (n) { p.nom = n; etat.edits[id + ":" + i] = Object.assign(etat.edits[id + ":" + i] || {}, { nom: n });
              sauver(); m.setTooltipContent(n); majGuide(); majListe(); } }
          else aller(id, i);
        });
        return m;
      });
    });
  }
  function majIcones() { // ne remplace que les icônes qui ont changé
    for (const id in marq) marq[id].forEach((m, i) => { const c = classePt(id, i);
      if (c !== m._cls) { m._cls = c; m.setIcon(iconePt(id, i, c)); if (c.includes("cible")) m.setZIndexOffset(1000); } });
  }

  // =====================================================================================
  // Guidage : plaque de rue, distance, progression, heure de fin
  // =====================================================================================
  let position = null, orientation = 0, alongPos = null, hors = false, termine = false;
  function majGuide() {
    const id = partId(), info = infoPart(id), p = cible(), dv = deriveDe(id);
    const nums = pts[id].filter((q) => q.num !== null).length;
    const fait = pts[id].slice(0, idxCur() + 1).filter((q) => q.num !== null).length;
    const b = $("badge"); txt(b, p.num !== null ? String(p.num) : "•"); b.style.background = info.couleur;
    txt($("rue"), p.nom); txt($("partTitre"), info.titre); txt($("prog"), `point ${Math.max(fait, 1)} / ${nums}`);
    if (position) {
      const droit = G.haversine(position, p.ll);
      const d = alongPos != null && !hors && dv.along[idxCur()] >= alongPos - 5 ? dv.along[idxCur()] - alongPos : droit;
      txt($("dist"), G.fmtDist(d));
      $("fleche").style.transform = `rotate(${Math.round(G.bearing(position, p.ll) - orientation)}deg)`;
    } else txt($("dist"), "–");
  }
  function majStats() {
    const t = tourneeCourante(), ds = t.parts.map(deriveDe), total = ds.reduce((a, d) => a + d.total, 0);
    const cur = alongPos != null && !hors ? alongPos : ds[etat.part].along[idxCur()];
    const fait = ds.slice(0, etat.part).reduce((a, d) => a + d.total, 0) + cur;
    const reste = Math.max(0, total - fait), pct = total ? Math.min(100, Math.round((fait / total) * 100)) : 0;
    const v = Math.max(5, etat.reg.vitesse) / 3.6;
    $("sKm").innerHTML = `<b>${G.fmtDist(reste)}</b> restants`;
    $("sFin").innerHTML = reste > 30 ? `fin vers <b>${G.fmtHeure(Date.now() + (reste / v) * 1000)}</b>` : "<b>terminé</b>";
    $("barreI").style.width = pct + "%"; $("barre").setAttribute("aria-valuenow", pct);
  }
  function majTout() { majIcones(); dessinerTraces(); majGuide(); majStats(); if (panneau === "tournee") { majListe(); majSegParts(); } }

  function parler(s) {
    if (!etat.reg.voix || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s); u.lang = "fr-FR"; speechSynthesis.speak(u);
  }
  function toast(s, ms = 4000) { const t = $("toast"); t.textContent = s; t.style.display = "block";
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = "none"), ms); }
  function banniere(s, rouge, ms) { const a = $("alerte");
    if (!s) { a.style.display = "none"; return; }
    a.textContent = s; a.className = rouge ? "rouge" : ""; a.style.display = "block";
    clearTimeout(banniere.h); if (ms) banniere.h = setTimeout(() => (a.style.display = "none"), ms); }

  function aller(id, i) { termine = false; etat.part = tourneeCourante().parts.indexOf(id); etat.idx[id] = i; sauver(); majTout(); map.panTo(cible().ll); }
  function avancer(delta) { // renvoie false quand le circuit est terminé
    const t = tourneeCourante(); let id = partId(), i = idxCur() + delta, ok = true;
    if (delta < 0) termine = false;
    if (delta > 0 && watch !== null && !termine) noterPassage(id, idxCur());
    if (i >= pts[id].length) {
      if (etat.part < t.parts.length - 1) { etat.part++; id = partId(); i = 0;
        const m = `${infoPart(t.parts[etat.part - 1]).titre} terminées. Place à : ${infoPart(id).titre}.`; toast(m); parler(m); }
      else { i = pts[id].length - 1; ok = false; termine = true; toast("Circuit terminé."); parler("Circuit terminé."); terminerSession(); }
    } else if (i < 0) {
      if (etat.part > 0) { etat.part--; id = partId(); i = pts[id].length - 1; } else i = 0;
    }
    etat.idx[id] = i; sauver(); majTout();
    const p = cible(); if (delta > 0 && ok) parler((p.num !== null ? "Point " + p.num + ". " : "") + p.nom);
    if (suivre && !position) map.panTo(p.ll);
    return ok;
  }

  // =====================================================================================
  // GPS : position, validation des points, alertes d'approche, trace, kilomètres
  // =====================================================================================
  let watch = null, wake = null, lastFix = null, lastCalc = 0, lastPan = 0;
  const annonces = new Set(), enreg = { on: false, pts: [], part: null };
  async function verrouEcran() { try { wake = await navigator.wakeLock?.request("screen"); } catch (e) { /* non supporté */ } }

  function demarrerGps() {
    if (!("geolocation" in navigator)) { toast("GPS indisponible sur cet appareil."); return; }
    termine = false; verrouEcran(); sessionCourante(true);
    watch = navigator.geolocation.watchPosition(onFix, (err) => {
      txt($("sEtat"), err.code === 1 ? "Localisation refusée" : "GPS indisponible");
      toast(err.code === 1 ? "Autorise la localisation pour ce site dans les réglages du navigateur." : "Signal GPS perdu, nouvelle tentative…");
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    txt($("sEtat"), "recherche du GPS…"); majBoutons();
  }
  function arreterGps() {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null; lastFix = null; if (wake) { wake.release().catch(() => {}); wake = null; }
    if (enreg.on) { enreg.on = false; terminerEnreg(); }
    txt($("sEtat"), "GPS arrêté"); banniere(null); majBoutons();
  }

  function onFix(g) {
    const c = g.coords, now = Date.now();
    position = [c.latitude, c.longitude];
    if (c.heading != null && !isNaN(c.heading) && (c.speed || 0) > 1) orientation = c.heading;
    txt($("sEtat"), `GPS ±${Math.round(c.accuracy)} m`);
    if (c.accuracy < 40) {
      if (lastFix) { const d = G.haversine(lastFix, position);
        if (d > 3 && d < 500) { const s = sessionCourante(false); if (s) s.km += d / 1000; lastFix = position; } }
      else lastFix = position;
    }
    if (enreg.on && c.accuracy < 35) { const l = enreg.pts[enreg.pts.length - 1];
      if (!l || G.haversine(l, position) >= 5) { enreg.pts.push(position); if (enreg.pts.length % 10 === 0) majBoutons(); } }
    if (!posMarker) {
      posMarker = L.circleMarker(position, { radius: 9, color: "#fff", weight: 3, fillColor: "#2a7bff", fillOpacity: 1, interactive: false }).addTo(map);
      precCercle = L.circle(position, { radius: c.accuracy, weight: 1, color: "#2a7bff", fillOpacity: 0.1, interactive: false }).addTo(map);
    } else { posMarker.setLatLng(position); precCercle.setLatLng(position).setRadius(c.accuracy); }
    if (now - lastCalc < 400) return; // la logique lourde tourne au plus ~2 fois par seconde
    lastCalc = now; traiter(now);
  }

  function traiter(now) {
    const id = partId(), dv = deriveDe(id), seg0 = suiviSeg[id] || 0;
    let s = G.nearestForward(dv.line, position, seg0 - 3, seg0 + 300, 15);
    if (s.dist > 120) s = G.nearestForward(dv.line, position, 0, dv.line.length - 2, 15);
    hors = s.dist > 80; alongPos = hors ? null : G.alongOf(dv.cum, s); if (!hors) suiviSeg[id] = s.seg;
    banniere(hors ? `Hors itinéraire (${Math.round(s.dist)} m)` : null, true);

    const i = idxCur(), p = pts[id][i], d = G.haversine(position, p.ll);
    const passe = !hors && alongPos > dv.along[i] + 40 && alongPos < dv.along[i] + 600 && i < pts[id].length - 1;
    if (termine) { /* circuit fini : plus de validation automatique */ }
    else if (d < etat.reg.rayon || passe) { avancer(1); lastCalc = 0; }
    else alerteApproche(d, p, id, i);
    majGuide(); majStats();
    if (suivre && (now - lastPan > 2500 || !map.getBounds().pad(-0.3).contains(position))) { lastPan = now; map.panTo(position, { animate: true, duration: 0.6 }); }
  }

  function alerteApproche(d, p, id, i) {
    const seuils = [300, 100], th = seuils.filter((x) => d <= x).pop();
    if (!th) return;
    const cle = `${id}:${i}:${th}`; if (annonces.has(cle)) return;
    seuils.filter((x) => x >= th).forEach((x) => annonces.add(`${id}:${i}:${x}`));
    const m = Math.max(10, Math.round(d / 10) * 10);
    const msg = /demi-tour/i.test(p.nom) ? `Demi-tour dans ${m} mètres` : `Dans ${m} mètres : ${p.num !== null ? "point " + p.num + ", " : ""}${p.nom}`;
    banniere(msg, false, 6000); parler(msg); if (navigator.vibrate) navigator.vibrate(180);
  }

  // =====================================================================================
  // Alignement sur les rues (OSRM, calcul en ligne puis conservé hors-ligne)
  // =====================================================================================
  let enCours = false;
  async function routeOsrm(base) {
    const radii = base.map(() => 300), use = base.map((_, i) => i);
    for (let essai = 0; essai < 25 && use.length > 1; essai++) {
      const coords = use.map((i) => base[i][1].toFixed(6) + "," + base[i][0].toFixed(6)).join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false&radiuses=${use.map((i) => radii[i]).join(";")}`;
      const rep = await fetch(url), r = await rep.json().catch(() => ({}));
      if (r.code === "Ok" && r.routes && r.routes[0]) return { r, use };
      if (r.code === "NoSegment") { // point trop loin d'une route : on élargit la recherche, puis on l'ignore
        const m = /(\d+)/.exec(r.message || ""), j = m ? +m[1] : -1;
        if (j >= 0 && j < use.length) { const i = use[j]; if (radii[i] < 3000) radii[i] *= 4; else use.splice(j, 1); continue; }
      }
      throw new Error(r.message || r.code || "HTTP " + rep.status);
    }
    throw new Error("aucun tracé possible");
  }
  async function aligner(silencieux) {
    if (enCours) return; enCours = true;
    if (silencieux !== true) toast("Alignement sur les rues…", 8000);
    try {
      for (const id of tourneeCourante().parts) {
        if (etat.traces[id]) continue; // une trace GPS réelle est plus fiable : rien à aligner
        const base = infoPart(id).src.map((_, i) => { const e = etat.edits[id + ":" + i]; return e && e.ll ? e.ll : brutDe(id, i).ll; });
        const { r, use } = await routeOsrm(base);
        etat.geo[id] = r.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
        etat.sn[id] = base.map(() => null); etat.nm[id] = base.map(() => "");
        r.waypoints.forEach((w, j) => { etat.sn[id][use[j]] = [w.location[1], w.location[0]]; etat.nm[id][use[j]] = w.name || ""; });
      }
      tourneeCourante().parts.forEach(construirePts); sauver(); dessinerMarqueurs(); majTout();
      toast("Points et tracés alignés sur les rues (OpenStreetMap).");
    } catch (e) { toast("Alignement impossible : " + (e.message || e) + ". Vérifie le réseau puis appuie sur « Aligner sur les rues ».", 7000); }
    enCours = false;
  }

  // =====================================================================================
  // Calage en 3 touches (moindres carrés : décalage + rotation + échelle)
  // =====================================================================================
  const REF = [["principal", 0], ["principal", 5], ["principal", 17]];
  const QUOI = ["le point n°1 : début du circuit, sur l'avenue de Coucy", "le rond-point des États-Unis (point n°6)",
    "le pont sur l'Aisne vers Pasly (point n°12)"];
  let calageEtape = 0, calageClics = [];
  function calerDebut() {
    if (tourneeCourante().id !== "n3") { toast("Le calage ne concerne que l'itinéraire n°3."); return; }
    fermerPanneau(); calageEtape = 1; calageClics = [];
    toast("Calage 1/3 : touche sur la carte " + QUOI[0] + ".", 12000);
  }
  map.on("click", (ev) => {
    if (!calageEtape) return;
    calageClics.push([ev.latlng.lat, ev.latlng.lng]);
    if (calageEtape < 3) { calageEtape++; toast(`Calage ${calageEtape}/3 : touche ${QUOI[calageEtape - 1]}.`, 12000); return; }
    calageEtape = 0;
    const z = REF.map(([id, i]) => { const p = infoPart(id).src[i]; return pxVersM(p[1], p[2]); }), w = calageClics.map(gpsVersM), n = z.length;
    const mz = [z.reduce((t, v) => t + v[0], 0) / n, z.reduce((t, v) => t + v[1], 0) / n];
    const mw = [w.reduce((t, v) => t + v[0], 0) / n, w.reduce((t, v) => t + v[1], 0) / n];
    let num = [0, 0], den = 0;
    for (let i = 0; i < n; i++) { const dz = [z[i][0] - mz[0], z[i][1] - mz[1]], dw = [w[i][0] - mw[0], w[i][1] - mw[1]];
      num[0] += dz[0] * dw[0] + dz[1] * dw[1]; num[1] += dz[0] * dw[1] - dz[1] * dw[0]; den += dz[0] ** 2 + dz[1] ** 2; }
    const a = [num[0] / den, num[1] / den], b = [mw[0] - (a[0] * mz[0] - a[1] * mz[1]), mw[1] - (a[0] * mz[1] + a[1] * mz[0])];
    etat.calage = { a, b };
    ITINERAIRES.forEach((it) => { delete etat.sn[it.id]; delete etat.nm[it.id]; delete etat.geo[it.id];
      Object.keys(etat.edits).filter((k) => k.startsWith(it.id + ":")).forEach((k) => delete etat.edits[k]); });
    sauver(); chargerTournee(true); aligner();
  });

  // =====================================================================================
  // Enregistrement de ta vraie trace GPS (remplace le tracé approximatif)
  // =====================================================================================
  function basculerEnreg() {
    if (!enreg.on) {
      if (watch === null) demarrerGps();
      enreg.on = true; enreg.pts = []; enreg.part = partId(); majBoutons();
      toast("Enregistrement : roule le circuit, puis appuie sur « Arrêter l'enregistrement ».", 6000);
    } else { enreg.on = false; terminerEnreg(); majBoutons(); }
  }
  function terminerEnreg() {
    if (enreg.pts.length < 5) { toast("Trace trop courte, ignorée."); return; }
    const id = enreg.part; etat.traces[id] = G.simplify(enreg.pts, 3); invalider(id); sauver(); majTout();
    const km = G.fmtDist(deriveDe(id).cum[deriveDe(id).cum.length - 1]);
    if (confirm(`Trace enregistrée (${km}). Recaler les numéros de points sur cette trace ?`)) recalerSurTrace(id);
  }
  function recalerSurTrace(id) {
    const sn = G.snapMonotone(pts[id].map((p) => p.ll), etat.traces[id]); let n = 0;
    sn.forEach((s, i) => { if (s.dist < 80) { etat.edits[id + ":" + i] = Object.assign(etat.edits[id + ":" + i] || {}, { ll: s.ll }); n++; } });
    construirePts(id); sauver(); dessinerMarqueurs(); majTout(); toast(`${n} points recalés sur ta trace.`);
  }

  // =====================================================================================
  // Import / export (GPX, JSON)
  // =====================================================================================
  const telecharger = (nom, contenu, mime) => { const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenu], { type: mime })); a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function exporterGpx() {
    const id = partId(), info = infoPart(id), d = deriveDe(id);
    const wpts = pts[id].filter((p) => p.num !== null).map((p) => ({ ll: p.ll, name: `${p.num} – ${p.nom}` }));
    telecharger(slug(info.titre) + ".gpx", G.toGPX({ name: info.titre, wpts, trk: d.line }), "application/gpx+xml");
  }
  function exporterJson() {
    const out = tourneeCourante().parts.map((id) => ({ id, titre: infoPart(id).titre,
      points: pts[id].map((p) => ({ numero: p.num, rue: p.nom, lat: +p.ll[0].toFixed(6), lon: +p.ll[1].toFixed(6) })) }));
    telecharger(slug(tourneeCourante().titre) + ".json", JSON.stringify(out, null, 2), "application/json");
  }
  async function importer(file) {
    try {
      const texte = await file.text(), base = file.name.replace(/\.[^.]+$/, ""), stamp = "i" + Date.now(), parts = [];
      if (/\.gpx$/i.test(file.name) || texte.trimStart().startsWith("<")) {
        const g = G.parseGPX(texte), line = g.trk.length > 1 ? g.trk : g.rte, nom = g.name || base;
        let points = g.wpts.map((w, i) => ({ num: i + 1, nom: w.name || "Point " + (i + 1), lat: w.ll[0], lon: w.ll[1] }));
        if (points.length < 2 && line.length > 1) points = [
          { num: 1, nom: "Départ", lat: line[0][0], lon: line[0][1] },
          { num: 2, nom: "Arrivée", lat: line[line.length - 1][0], lon: line[line.length - 1][1] }];
        if (points.length < 2) throw new Error("aucun point ni tracé dans ce GPX");
        parts.push({ id: stamp + "p0", titre: nom, couleur: COULEURS[0], points });
        if (line.length > 1) etat.traces[stamp + "p0"] = G.simplify(line, 3);
      } else {
        const j = JSON.parse(texte), arr = Array.isArray(j) ? j : j.parts || [j];
        arr.forEach((p, k) => { const points = (p.points || []).map((q, i) => ({ num: q.numero ?? q.num ?? null,
          nom: q.rue || q.nom || "Point " + (i + 1), lat: +q.lat, lon: +q.lon })).filter((q) => isFinite(q.lat) && isFinite(q.lon));
          if (points.length > 1) parts.push({ id: stamp + "p" + k, titre: p.titre || "Partie " + (k + 1), couleur: COULEURS[k % 4], points }); });
        if (!parts.length) throw new Error("aucune partie valide dans ce JSON");
      }
      etat.imports.push({ id: stamp, titre: (parts.length === 1 ? parts[0].titre : base), parts });
      etat.tournee = stamp; etat.part = 0; sauver(); chargerTournee(true); majSelTournee();
      toast("Circuit importé : " + parts.length + " partie(s).");
    } catch (e) { toast("Import impossible : " + (e.message || e), 6000); }
  }

  // =====================================================================================
  // Journal de tournée (heures, kilomètres, sel, passages) + export CSV / PDF
  // =====================================================================================
  function sessionCourante(creer) {
    let s = etat.journal.find((j) => j.id === etat.session);
    if (s && Date.now() - s.debut > 12 * 3600e3) { s.fin = s.fin || Date.now(); etat.session = null; s = null; }
    if (!s && creer) {
      s = { id: "s" + Date.now(), debut: Date.now(), fin: null, tournee: tourneeCourante().titre, passages: [], selKg: "", notes: "",
        km: 0, meteo: etat.meteo && etat.meteo.risk ? `${etat.meteo.temp != null ? etat.meteo.temp + "°C, " : ""}${etat.meteo.risk.libelle}` : "" };
      etat.journal.unshift(s); etat.journal = etat.journal.slice(0, 60); etat.session = s.id; sauver(); majJournal();
    }
    return s || null;
  }
  function noterPassage(id, i) {
    const s = sessionCourante(true), p = pts[id][i];
    s.passages.push({ c: infoPart(id).titre, n: p.num, r: p.nom, t: Date.now() }); sauver();
  }
  function terminerSession() {
    const s = sessionCourante(false); if (!s) return;
    s.fin = Date.now(); etat.session = null; sauver(); majJournal();
  }
  function majJournal() {
    const s = sessionCourante(false), cur = $("jCourant");
    $("jSel").disabled = $("jNotes").disabled = !s;
    if (s) { cur.innerHTML = `<b>Tournée en cours</b><br>${s.tournee}<br>Départ ${G.fmtHeure(s.debut)} · ${G.fmtDuree((Date.now() - s.debut) / 1000)} · ` +
        `${s.km.toFixed(1).replace(".", ",")} km · ${s.passages.length} points passés`;
      if (document.activeElement !== $("jSel")) $("jSel").value = s.selKg;
      if (document.activeElement !== $("jNotes")) $("jNotes").value = s.notes; }
    else { cur.textContent = "Aucune tournée en cours. Elle démarre quand tu appuies sur « Démarrer »."; $("jSel").value = ""; $("jNotes").value = ""; }
    const l = $("jListe"); l.innerHTML = "";
    etat.journal.forEach((j) => { const b = document.createElement("button"); b.type = "button";
      b.innerHTML = `<span class="n" style="background:var(--surf2);color:var(--texte)">${j.passages.length}</span><span>${G.fmtDate(j.debut)} · ${G.fmtHeure(j.debut)}` +
        `${j.fin ? "–" + G.fmtHeure(j.fin) : " (en cours)"}<br><span class="d">${j.tournee}</span></span><span class="d">${j.km.toFixed(1).replace(".", ",")} km${j.selKg !== "" ? " · " + j.selKg + " kg" : ""}</span>`;
      l.appendChild(b); });
    if (!etat.journal.length) l.textContent = "Aucune tournée enregistrée pour l'instant.";
  }
  function exporterCsv() {
    const rows = [["Date", "Début", "Fin", "Tournée", "Circuit", "Point", "Rue", "Heure de passage", "Km tournée", "Sel (kg)", "Notes", "Météo"]];
    etat.journal.slice().reverse().forEach((j) => { const base = [G.fmtDate(j.debut), G.fmtHeure(j.debut), j.fin ? G.fmtHeure(j.fin) : "", j.tournee];
      const fin = [j.km.toFixed(1).replace(".", ","), j.selKg, j.notes, j.meteo];
      if (!j.passages.length) rows.push([...base, "", "", "", "", ...fin]);
      j.passages.forEach((p) => rows.push([...base, p.c, p.n == null ? "" : p.n, p.r, G.fmtHeure(p.t), ...fin])); });
    telecharger("journal-salage.csv", G.toCSV(rows), "text/csv;charset=utf-8");
  }
  function imprimerPdf() {
    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    let h = "<h1>Journal de tournée de salage</h1><div>Itinéraire n°3 – Soissons</div>";
    etat.journal.forEach((j) => { h += `<h2 style="margin:14pt 0 0;font-size:12pt">${G.fmtDate(j.debut)} · ${G.fmtHeure(j.debut)}${j.fin ? "–" + G.fmtHeure(j.fin) : ""} · ${esc(j.tournee)}</h2>` +
      `<div>${j.km.toFixed(1).replace(".", ",")} km · sel : ${j.selKg === "" ? "non renseigné" : esc(j.selKg) + " kg"} · ${j.passages.length} points passés` +
      `${j.meteo ? " · météo : " + esc(j.meteo) : ""}${j.notes ? "<br>Notes : " + esc(j.notes) : ""}</div>` +
      (j.passages.length ? "<table><tr><th>Heure</th><th>Circuit</th><th>Point</th><th>Rue</th></tr>" + j.passages.map((p) =>
        `<tr><td>${G.fmtHeure(p.t)}</td><td>${esc(p.c)}</td><td>${p.n == null ? "" : p.n}</td><td>${esc(p.r)}</td></tr>`).join("") + "</table>" : ""); });
    if (!etat.journal.length) h += "<p>Aucune tournée enregistrée.</p>";
    $("impression").innerHTML = h; window.print();
  }

  // =====================================================================================
  // Météo et risque de verglas (Open-Meteo, sans clé)
  // =====================================================================================
  async function chargerMeteo(force) {
    const m = etat.meteo;
    if (force || !m || Date.now() - m.t > 30 * 60e3) {
      const ll = position || SOISSONS;
      try {
        const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ll[0].toFixed(3)}&longitude=${ll[1].toFixed(3)}` +
          `&hourly=temperature_2m,precipitation,soil_temperature_0cm&current=temperature_2m&forecast_hours=12&timezone=auto`)).json();
        const risk = G.iceRisk(r.hourly);
        if (risk) { etat.meteo = { t: Date.now(), temp: r.current ? Math.round(r.current.temperature_2m) : null, risk }; sauver(); }
      } catch (e) { /* hors-ligne : on garde la dernière météo connue */ }
    }
    majMeteo();
  }
  function majMeteo() {
    const m = etat.meteo, puce = $("sMeteo"), carte = $("meteoCarte");
    if (!m || !m.risk) { puce.innerHTML = ""; carte.textContent = "Météo indisponible (réseau nécessaire)."; return; }
    const r = m.risk, f = (x) => (Math.round(x * 10) / 10).toString().replace(".", ",");
    puce.innerHTML = `<span class="meteo-puce ${r.niveau}">${r.niveau === "faible" ? "" : "❄ "}${m.temp != null ? m.temp + "° · " : ""}${r.niveau === "eleve" ? "verglas probable" : r.niveau === "moyen" ? "gel possible" : "pas de gel"}</span>`;
    carte.innerHTML = `<b>${r.libelle}</b><br>${m.temp != null ? "Maintenant : " + m.temp + " °C · " : ""}minimum sur 12 h : ${f(r.minT)} °C (sol : ${f(r.minSol)} °C) · pluie : ${f(r.pluie)} mm` +
      `<br><span class="d" style="color:var(--doux)">Mis à jour à ${G.fmtHeure(m.t)} · indicatif, ne remplace pas la vigilance Météo-France</span>`;
  }

  // =====================================================================================
  // Interface : panneaux, réglages, boutons
  // =====================================================================================
  let panneau = null;
  const TITRES = { tournee: "Tournée", journal: "Journal de tournée", reglages: "Réglages" };
  function ouvrirPanneau(nom) {
    if (panneau === nom) { fermerPanneau(); return; }
    panneau = nom; $("feuille").hidden = false; $("feuilleTitre").textContent = TITRES[nom];
    document.querySelectorAll(".panneau").forEach((p) => (p.hidden = p.id !== "p-" + nom));
    document.querySelectorAll("#onglets button").forEach((b) => b.classList.toggle("on", b.dataset.p === nom));
    if (nom === "tournee") { majListe(); majSegParts(); majMeteo(); } if (nom === "journal") majJournal();
  }
  function fermerPanneau() { panneau = null; $("feuille").hidden = true; document.querySelectorAll("#onglets button").forEach((b) => b.classList.remove("on")); }

  function majSelTournee() {
    const s = $("selTournee"); s.innerHTML = "";
    tournees().forEach((t) => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.titre; s.appendChild(o); });
    s.value = etat.tournee;
  }
  function majSegParts() {
    const seg = $("segParts"), t = tourneeCourante(); seg.innerHTML = ""; seg.hidden = t.parts.length < 2;
    t.parts.forEach((id, k) => { const b = document.createElement("button"); b.type = "button"; b.textContent = infoPart(id).titre;
      b.classList.toggle("on", k === etat.part);
      b.onclick = () => { etat.part = k; sauver(); majTout(); map.panTo(cible().ll); }; seg.appendChild(b); });
  }
  function majListe() {
    const id = partId(), l = $("liste"), dv = deriveDe(id), info = infoPart(id), frag = document.createDocumentFragment();
    pts[id].forEach((p, i) => {
      const b = document.createElement("button"); b.type = "button";
      b.className = (i === idxCur() ? "cur " : "") + (i < idxCur() ? "fait" : "");
      const d = position ? G.haversine(position, p.ll) : dv.along[i];
      b.innerHTML = `<span class="n" style="background:${info.couleur}">${p.num !== null ? p.num : "•"}</span><span></span><span class="d">${G.fmtDist(d)}</span>`;
      b.children[1].textContent = p.nom; b.onclick = () => aller(id, i); frag.appendChild(b);
    });
    l.innerHTML = ""; l.appendChild(frag);
    const cur = l.querySelector(".cur"); if (cur && panneau === "tournee") cur.scrollIntoView({ block: "nearest" });
  }
  function majBoutons() {
    const b = $("bStart"); b.textContent = watch === null ? "Démarrer" : "Arrêter"; b.classList.toggle("actif", watch !== null);
    $("bEdit").classList.toggle("on", editMode);
    $("bRec").classList.toggle("on", enreg.on); $("bRec").textContent = enreg.on ? `Arrêter l'enregistrement (${enreg.pts.length})` : "Enregistrer ma trace";
    $("bCaler").disabled = tourneeCourante().id !== "n3";
  }

  function segmenter(id, valeur, cb) {
    const seg = $(id); const maj = () => seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === String(valeur())));
    seg.querySelectorAll("button").forEach((b) => (b.onclick = () => { cb(b.dataset.v); maj(); })); maj(); return maj;
  }
  function appliquerReglages() {
    const r = etat.reg, h = new Date().getHours();
    document.documentElement.style.setProperty("--echelle", r.echelle);
    const nuit = r.theme === "nuit" || (r.theme === "auto" && (matchMedia("(prefers-color-scheme: dark)").matches || h >= 18 || h < 7));
    document.documentElement.dataset.theme = nuit ? "nuit" : "jour";
    document.querySelector("meta[name=theme-color]").content = nuit ? "#0b1620" : "#eef3f6";
    ajusterDock();
  }
  const ajusterDock = () => document.documentElement.style.setProperty("--dockh", $("dock").offsetHeight + "px");

  function chargerTournee(recadrer) {
    const t = tourneeCourante(); if (etat.part >= t.parts.length) etat.part = 0;
    termine = false; t.parts.forEach(construirePts); dessinerMarqueurs(); majTout(); majBoutons();
    if (recadrer) map.fitBounds(L.latLngBounds(t.parts.flatMap((id) => deriveDe(id).line)), { padding: [24, 24] });
  }

  // ---------- branchements ----------
  $("bStart").onclick = () => (watch === null ? demarrerGps() : arreterGps());
  $("bPrec").onclick = () => avancer(-1);
  $("bSuiv").onclick = () => avancer(1);
  $("bSuivi").onclick = (e) => { suivre = !suivre; e.currentTarget.classList.toggle("on", suivre); e.currentTarget.setAttribute("aria-pressed", suivre);
    if (suivre) map.panTo(position || cible().ll); };
  map.on("dragstart", () => { if (suivre) { suivre = false; $("bSuivi").classList.remove("on"); $("bSuivi").setAttribute("aria-pressed", "false"); } });
  $("bNuit").onclick = () => { etat.reg.theme = document.documentElement.dataset.theme === "nuit" ? "jour" : "nuit"; sauver(); appliquerReglages(); majSegTheme(); };
  document.querySelectorAll("#onglets button").forEach((b) => (b.onclick = () => ouvrirPanneau(b.dataset.p)));
  $("fermer").onclick = fermerPanneau;
  $("selTournee").onchange = (e) => { etat.tournee = e.target.value; etat.part = 0; sauver(); chargerTournee(true); majSegParts(); majListe(); };
  $("bCaler").onclick = calerDebut;
  $("bRoute").onclick = () => aligner();
  $("bRec").onclick = basculerEnreg;
  $("bEffTrace").onclick = () => { const id = partId();
    if (!etat.traces[id]) { toast("Aucune trace enregistrée pour cette partie."); return; }
    if (confirm("Effacer la trace enregistrée de cette partie ?")) { delete etat.traces[id]; invalider(id); sauver(); majTout(); } };
  $("bEdit").onclick = () => { editMode = !editMode; majBoutons(); dessinerMarqueurs();
    toast(editMode ? "Mode édition : glisse un point, touche-le pour renommer la rue." : "Édition terminée."); };
  $("bImport").onclick = () => $("fichier").click();
  $("fichier").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importer(f); };
  $("bGpx").onclick = exporterGpx; $("bJson").onclick = exporterJson;
  $("jFin").onclick = () => { if (!sessionCourante(false)) { toast("Aucune tournée en cours."); return; } terminerSession(); toast("Tournée terminée et enregistrée dans le journal."); };
  $("jCsv").onclick = exporterCsv; $("jPdf").onclick = imprimerPdf;
  $("jSel").oninput = (e) => { const s = sessionCourante(false); if (s) { s.selKg = e.target.value; sauver(); } };
  $("jNotes").oninput = (e) => { const s = sessionCourante(false); if (s) { s.notes = e.target.value; sauver(); } };
  const majSegTheme = segmenter("segTheme", () => etat.reg.theme, (v) => { etat.reg.theme = v; sauver(); appliquerReglages(); });
  segmenter("segTaille", () => etat.reg.echelle, (v) => { etat.reg.echelle = +v; sauver(); appliquerReglages(); });
  $("rVoix").checked = etat.reg.voix;
  $("rVoix").onchange = (e) => { etat.reg.voix = e.target.checked; sauver(); if (etat.reg.voix) parler("Guidage vocal activé"); };
  $("rRayon").value = etat.reg.rayon; txt($("rRayonV"), etat.reg.rayon + " m");
  $("rRayon").oninput = (e) => { etat.reg.rayon = +e.target.value; txt($("rRayonV"), etat.reg.rayon + " m"); sauver(); };
  $("rVitesse").value = etat.reg.vitesse;
  $("rVitesse").onchange = (e) => { etat.reg.vitesse = Math.min(60, Math.max(5, +e.target.value || 25)); e.target.value = etat.reg.vitesse; sauver(); majStats(); };
  $("rReset").onclick = () => { if (confirm("Tout effacer (calage, corrections, traces, journal) ?")) { localStorage.removeItem(CLE); location.reload(); } };
  addEventListener("resize", ajusterDock);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { appliquerReglages(); if (watch !== null && !wake) verrouEcran(); } });
  setInterval(() => { if (etat.reg.theme === "auto") appliquerReglages(); }, 10 * 60e3);

  // ---------- démarrage ----------
  appliquerReglages(); majSelTournee(); chargerTournee(true); majJournal();
  const n3 = tourneeCourante().id === "n3";
  if (n3 && !etat.calage) toast("Première utilisation : ouvre Tournée → « Caler le circuit » et touche 3 repères sur la carte.", 15000);
  else if (tourneeCourante().parts.some((id) => !etat.geo[id] && !etat.traces[id])) aligner(true);
  chargerMeteo(false);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
