// Logique pure du suivi : plan par défaut, lecture des actions, calendrier, euphorie, rappels.
// Aucun accès au DOM ni au stockage : testable avec `node --test`.

export const DELAI_HEURES = 10;
export const HEURE_MATIN = 8;
export const HEURE_SOIR = 18;
export const JOURS_CAMPAGNE = 11;
export const ETAPES_MAX = JOURS_CAMPAGNE * 2;

export const FAMILLES = ["Habitations", "Production", "Culture", "Militaire", "Biens"];

// L'ordre compte : les noms les plus longs d'abord.
export const BATIMENTS = [
  { cle: "maison-etages", nom: "Maison à étages", pluriel: "Maisons à étages", famille: "Habitations", motif: "maisons? [àa] [ée]tages?" },
  { cle: "maison-charpente", nom: "Maison à charpente", pluriel: "Maisons à charpente", famille: "Habitations", motif: "maisons? [àa] charpentes?" },
  { cle: "maison-bois", nom: "Maison en bois", pluriel: "Maisons en bois", famille: "Habitations", motif: "maisons? en bois" },
  { cle: "propriete", nom: "Propriété", pluriel: "Propriétés", famille: "Habitations", motif: "propri[ée]t[ée]s?" },
  { cle: "tannerie", nom: "Tannerie", pluriel: "Tanneries", famille: "Production", motif: "tanneries?" },
  { cle: "brasserie", nom: "Brasserie", pluriel: "Brasseries", famille: "Production", motif: "brasseries?" },
  { cle: "cordonnier", nom: "Cordonnier", pluriel: "Cordonniers", famille: "Production", motif: "cordonniers?" },
  { cle: "boulangerie", nom: "Boulangerie", pluriel: "Boulangeries", famille: "Production", motif: "boulangeries?" },
  { cle: "eglise", nom: "Église", pluriel: "Églises", famille: "Culture", motif: "[ée]glises?" },
  { cle: "palais", nom: "Palais", pluriel: "Palais", famille: "Culture", motif: "palais" },
  { cle: "bibliotheque", nom: "Bibliothèque", pluriel: "Bibliothèques", famille: "Culture", motif: "biblioth[èe]ques?" },
  { cle: "medecin", nom: "Médecin", pluriel: "Médecins", famille: "Culture", motif: "m[ée]decins?" },
  { cle: "pilori", nom: "Pilori", pluriel: "Piloris", famille: "Culture", motif: "piloris?" },
  { cle: "potence", nom: "Potence", pluriel: "Potences", famille: "Culture", motif: "potences?" },
  { cle: "decoration", nom: "Décoration", pluriel: "Décorations", famille: "Culture", motif: "d[ée]corations?|d[ée]cos?" },
  { cle: "caserne", nom: "Caserne", pluriel: "Casernes", famille: "Militaire", motif: "casernes?" },
  { cle: "corderie", nom: "Corderie", pluriel: "Corderies", famille: "Biens", motif: "corderies?" },
  { cle: "apiculture", nom: "Apiculture", pluriel: "Apicultures", famille: "Biens", motif: "apicultures?" },
  { cle: "poudre", nom: "Manufacture de poudre", pluriel: "Manufactures de poudre", famille: "Biens", motif: "manufactures?(?: de poudre)?" },
];

const DEBUT = "(?<!\\p{L})";
const LECTURE = new RegExp(
  `(?<vendre>${DEBUT}(?:re)?vend\\p{L}*)` +
  `|(?<poser>${DEBUT}pos(?:er|e|é)\\p{L}*)` +
  `|(?<pause>${DEBUT}(?:commenc|continu)\\p{L}*)` +
  `|(?<neutre>${DEBUT}(?:boost|chois|compl[eé]t|remplac|fini|fai[rst])\\p{L}*)` +
  `|(?:${DEBUT}(?<nx>\\d+)\\s+)?(?<ext>${DEBUT}extensions?)` +
  `|${DEBUT}(?:(?<n>\\d+)\\s+|(?<art>une?|la|le)\\s+|(?<eli>l[’']))(?:derni[eè]re?s?\\s+)?(?<bat>${BATIMENTS.map(b => b.motif).join("|")})(?!\\p{L})`,
  "giu");

/** Lit une action écrite en français et en déduit ses effets sur la colonie. */
export function lireAction(texte) {
  const effets = { tout: /tout\s+(?:re)?vend/iu.test(texte), deltas: {}, extensions: 0 };
  let signe = 0, extensionPossible = true;
  for (const m of texte.matchAll(LECTURE)) {
    const g = m.groups;
    if (g.vendre) { signe = -1; extensionPossible = true; }
    else if (g.poser) { signe = 1; extensionPossible = true; }
    else if (g.pause) { signe = 0; extensionPossible = false; }
    else if (g.neutre) { signe = 0; extensionPossible = true; }
    else if (g.ext) {
      const avant = texte.slice(0, m.index);
      if (extensionPossible && !/(?:prochaines?|l[’'])\s*$/iu.test(avant)) effets.extensions += Number(g.nx ?? 1);
    } else if (g.bat && signe !== 0) {
      const bat = BATIMENTS.find(b => new RegExp(`^(?:${b.motif})$`, "iu").test(g.bat));
      effets.deltas[bat.cle] = (effets.deltas[bat.cle] ?? 0) + signe * Number(g.n ?? 1);
    }
  }
  return effets;
}

/** Phrase courte qui dit ce que l'app a compris d'une action. */
export function resumerEffets(effets) {
  const morceaux = [];
  if (effets.tout) morceaux.push("tout est vendu");
  for (const [cle, n] of Object.entries(effets.deltas)) {
    if (n === 0) continue;
    const b = BATIMENTS.find(x => x.cle === cle);
    morceaux.push(`${n > 0 ? "+" : "−"}${Math.abs(n)} ${(Math.abs(n) > 1 ? b.pluriel : b.nom).toLowerCase()}`);
  }
  if (effets.extensions) morceaux.push(`+${effets.extensions} extension${effets.extensions > 1 ? "s" : ""}`);
  return morceaux.join(", ");
}

/**
 * État de la colonie d'après les actions cochées, dans l'ordre du plan.
 * `ajouts` : bâtiments notés à la main, [{ etape, cle, n }], appliqués à la fin de leur étape.
 */
export function etatColonie(plan, coches, ajouts = []) {
  const batiments = {};
  let extensions = 0;
  for (const [i, etape] of plan.etapes.entries()) {
    for (const action of etape.actions) {
      if (!coches[action.id]) continue;
      const effets = lireAction(action.texte);
      if (effets.tout) for (const cle of Object.keys(batiments)) batiments[cle] = 0;
      for (const [cle, n] of Object.entries(effets.deltas)) batiments[cle] = Math.max(0, (batiments[cle] ?? 0) + n);
      extensions += effets.extensions;
    }
    for (const a of ajouts) if (a.etape === i) batiments[a.cle] = Math.max(0, (batiments[a.cle] ?? 0) + a.n);
  }
  return { batiments, extensions };
}

// ---------- Calendrier ----------

export function dateLocale(iso) {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(a, m - 1, j);
}

export function isoJour(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Créneau prévu de l'étape i : matin du jour 0, soir du jour 0, matin du jour 1… */
export function creneau(debutIso, i) {
  const d = dateLocale(debutIso);
  d.setDate(d.getDate() + Math.floor(i / 2));
  d.setHours(i % 2 ? HEURE_SOIR : HEURE_MATIN, 0, 0, 0);
  return d;
}

/** Heure à partir de laquelle l'étape i peut être faite. */
export function pretA(debutIso, i, validationPrecedente) {
  if (i === 0 || !validationPrecedente) return creneau(debutIso, i);
  const t = new Date(new Date(validationPrecedente).getTime() + DELAI_HEURES * 3600000);
  if (t.getHours() < HEURE_MATIN) t.setHours(HEURE_MATIN, 0, 0, 0);
  return t;
}

/** Dernier jeudi, aujourd'hui compris. */
export function dernierJeudi(d = new Date()) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 3) % 7));
  return r;
}

/** Une routine cochée reste cochée jusqu'à la fin du jour ou de la semaine (lundi). */
export function routineFaite(routine, maintenant = new Date()) {
  if (!routine.faitLe) return false;
  const fait = new Date(routine.faitLe);
  if (routine.periode === "jour") return isoJour(fait) === isoJour(maintenant);
  const lundi = d => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return isoJour(r); };
  return lundi(fait) === lundi(maintenant);
}

// ---------- Euphorie ----------

const PALIERS = [[20, 0.2, "Rébellion"], [60, 0.6, "Indiscipliné"], [80, 0.8, "Malheureux"], [120, 1, "Neutre"], [140, 1.1, "Contenu"], [200, 1.2, "Heureux"], [Infinity, 1.5, "Enthousiaste"]];

/** Palier d'euphorie d'après la population et les points d'euphorie lus dans le jeu. */
export function euphorie(population, points) {
  if (!(population > 0) || !(points >= 0)) return null;
  const pct = points / population * 100;
  const [, coef, etat] = PALIERS.find(([max]) => pct <= max);
  const seuil = 2 * population;
  return {
    pct, coef, etat,
    manque: points > seuil ? 0 : seuil + 1 - points,
    habitantsPossibles: points > seuil ? Math.ceil(points / 2) - 1 - population : 0,
  };
}

// ---------- Rappel de calendrier ----------

const utc = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const echapper = t => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

export function ics(titre, date, description = "", maintenant = new Date()) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Suivi FOE//FR", "BEGIN:VEVENT",
    `UID:${utc(date)}-${Math.round(maintenant.getTime() / 1000)}@suivi-foe`,
    `DTSTAMP:${utc(maintenant)}`, `DTSTART:${utc(date)}`, `DTEND:${utc(new Date(date.getTime() + 15 * 60000))}`,
    `SUMMARY:${echapper(titre)}`, `DESCRIPTION:${echapper(description)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${echapper(titre)}`, "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

// ---------- Plan de base ----------

const ETAPES_DE_BASE = [
  ["Mise en place", ["Choisir les bâtiments de biens : apiculture, corderie, manufacture de poudre", "Choisir les casernes : artillerie et 2 autres", "Prendre 1 extension en cuivre et 2 extensions en éclats (100 et 150)", "Poser 3 églises, 2 palais, 5 maisons à étages, 2 propriétés, 8 tanneries, 3 brasseries"]],
  ["1ʳᵉ récolte", ["Vendre 3 tanneries, poser 1 cordonnier", "Booster le cordonnier pour poser 1 boulangerie", "Vendre 2 palais, poser 2 bibliothèques et les laisser construire"]],
  ["2ᵉ récolte", ["Vendre 1 tannerie", "Poser 1 maison à charpente et la manufacture de poudre", "1 h plus tard : extension (60), revendre la manufacture, poser l’apiculture", "1 h plus tard : extension (90), revendre l’apiculture"]],
  ["3ᵉ récolte", ["Vendre 1 église, poser 1 médecin", "Poser 1 maison à charpente et 1 propriété", "Compléter l’euphorie avec des potences"]],
  ["4ᵉ récolte", ["Poser 1 maison en bois, vendre 1 maison à étages", "Booster pour poser 1 caserne de trébuchets"]],
  ["5ᵉ récolte", ["Vendre 1 église, poser 1 médecin", "Poser 1 corderie pour les prochaines extensions", "Faire les unités, puis revendre la caserne", "Poser des bâtiments culturels (pilori ou potence)"]],
  ["6ᵉ récolte", ["Poser 1 maison en bois", "Poser un bâtiment culturel", "Commencer les ressources de la prochaine extension"]],
  ["7ᵉ récolte", ["Vendre 1 tannerie, poser 1 boulangerie", "Vendre la dernière église, poser 1 médecin", "Poser 1 propriété", "Faire une extension (130)", "Compléter avec des bâtiments culturels"]],
  ["8ᵉ récolte", ["Faire une extension", "Vendre 2 tanneries", "Poser 1 boulangerie et des bâtiments culturels", "Commencer une extension"]],
  ["9ᵉ récolte", ["Vendre la dernière tannerie, poser 1 boulangerie", "Vendre 1 bibliothèque, la remplacer par de meilleurs bâtiments culturels", "Continuer les ressources de l’extension"]],
  ["10ᵉ récolte", ["Poser 1 boulangerie", "Vendre la bibliothèque, la remplacer par des piloris", "Faire une extension"]],
  ["11ᵉ récolte", ["Poser 1 boulangerie et 1 maison en bois", "Vendre 1 maison à étages", "Vendre la corderie, poser 1 caserne de canons et la laisser construire", "Compléter avec des bâtiments culturels ou des décorations"]],
  ["12ᵉ récolte", ["Faire des unités de canons", "Poser décoration ou bâtiment culturel"]],
  ["13ᵉ récolte", ["Finir les unités, vendre la caserne", "Poser la corderie", "Poser 1 maison en bois, vendre les 2 dernières maisons à étages", "Poser bâtiments culturels et décorations selon les besoins"]],
  ["14ᵉ récolte", ["Faire 1 extension", "Vendre le cordonnier, poser 1 boulangerie", "Si la population manque : poser 1 propriété", "Poser bâtiments culturels ou décorations selon les besoins"]],
  ["15ᵉ récolte", ["Poser décorations et bâtiments culturels", "Commencer les ressources de la prochaine extension"]],
  ["16ᵉ récolte", ["Faire une extension", "Poser bâtiments culturels et décorations"]],
  ["17ᵉ récolte", ["Faire une extension", "Poser décorations et bâtiments culturels"]],
  ["18ᵉ récolte", ["Faire une extension", "Poser décorations et bâtiments culturels"]],
  ["Dernière récolte", ["Tout vendre", "Poser des piloris partout, et des décorations si besoin"]],
];

export function planDeBase() {
  let n = 0;
  return {
    id: "base", nom: "Plan de base",
    etapes: ETAPES_DE_BASE.map(([nom, actions]) => ({ nom, actions: actions.map(texte => ({ id: `b${++n}`, texte })) })),
  };
}
