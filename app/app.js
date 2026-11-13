import {
  BATIMENTS, FAMILLES, ETAPES_MAX, JOURS_CAMPAGNE, planDeBase, lireAction, resumerEffets, etatColonie,
  dateLocale, isoJour, creneau, pretA, dernierJeudi, routineFaite, euphorie, ics,
} from "./logique.js";

// ---------- État enregistré sur l'appareil ----------

const CLE = "suivi-foe-v1";

function etatInitial() {
  return {
    v: 1,
    plans: [planDeBase()],
    campagne: null, // { debut, planId, coches: {idAction: true}, validations: [iso|null] }
    historique: [],
    routines: [
      { id: "r1", texte: "Récolter la ville principale", periode: "jour", faitLe: null },
      { id: "r2", texte: "Aider les amis et la guilde", periode: "jour", faitLe: null },
      { id: "r3", texte: "Passer à la taverne des amis", periode: "jour", faitLe: null },
      { id: "r4", texte: "Faire le défi quotidien", periode: "jour", faitLe: null },
      { id: "r5", texte: "Expédition de guilde", periode: "semaine", faitLe: null },
      { id: "r6", texte: "Champs de bataille de guilde", periode: "semaine", faitLe: null },
    ],
    colonie: { population: "", points: "" },
  };
}

function charger() {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE));
    if (lu?.v === 1 && Array.isArray(lu.plans) && lu.plans.length) return lu;
  } catch { /* stockage vide ou illisible : on repart du plan de base */ }
  return etatInitial();
}

let etat = charger();
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage indisponible */ } };

const ui = { vue: "recolte", planId: null, editionPlan: false, editionRoutines: false, ouverts: new Set() };

// ---------- Outils d'affichage ----------

const NB = " ";
const e = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const id = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pluriel = (n, mot) => `${n}${NB}${mot}${n > 1 ? "s" : ""}`;
const fmtHeure = d => `${d.getHours()}${NB}h${NB}${String(d.getMinutes()).padStart(2, "0")}`;
const fmtJour = d => d.toLocaleDateString("fr-FR", { weekday: "long" });
const fmtDate = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }).replace(/^1 /, "1ᵉʳ ").replace(/ /g, NB);
const fmtLong = d => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).replace(/ 1 /, " 1ᵉʳ ");
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);
const quand = (d, maintenant = new Date()) => (isoJour(d) === isoJour(maintenant) ? "" : fmtJour(d) + " ") + "à " + fmtHeure(d);
const duree = ms => {
  const min = Math.max(1, Math.round(ms / 60000));
  return min < 60 ? `${min}${NB}min` : `${Math.floor(min / 60)}${NB}h${NB}${String(min % 60).padStart(2, "0")}`;
};
const rang = (i, n) => (i === 0 ? "D" : i === n - 1 ? "F" : i);
const moment = i => (i % 2 ? "soir" : "matin");

const planDe = pid => etat.plans.find(p => p.id === pid);
const planCampagne = () => etat.campagne && planDe(etat.campagne.planId);
const indexCourant = () => {
  const n = planCampagne().etapes.length;
  for (let i = 0; i < n; i++) if (!etat.campagne.validations[i]) return i;
  return n;
};
const jourCampagne = (debutIso, j) => { const d = dateLocale(debutIso); d.setDate(d.getDate() + j); return d; };

// ---------- Vue : récolte du moment ----------

function frise(plan, courant) {
  const c = etat.campagne, n = plan.etapes.length;
  let html = "";
  for (let j = 0; j < JOURS_CAMPAGNE; j++) html += `<span>${fmtJour(jourCampagne(c.debut, j)).charAt(0).toUpperCase()}</span>`;
  for (const m of [0, 1]) {
    for (let j = 0; j < JOURS_CAMPAGNE; j++) {
      const i = j * 2 + m;
      html += i >= n ? `<b class="vide"></b>` : `<b class="${i < courant ? "fait" : i === courant ? "cours" : ""}">${rang(i, n)}</b>`;
    }
  }
  const faites = c.validations.slice(1, n).filter(Boolean).length;
  return `<h2>Campagne</h2>
  <div class="verre bloc">
    <p><strong class="num">${pluriel(faites, "récolte")} sur ${n - 1}</strong> <span class="petit">validée${faites > 1 ? "s" : ""}</span></p>
    <div class="frise" role="img" aria-label="Calendrier de la campagne : ${courant} étape${courant > 1 ? "s" : ""} validée${courant > 1 ? "s" : ""} sur ${n}">${html}</div>
    <p class="legende"><span>Ligne du haut : matin</span><span>Ligne du bas : soir</span><span>D : départ, F : finale</span></p>
  </div>`;
}

function vueRecolte() {
  const c = etat.campagne, maintenant = new Date();
  if (!c) {
    return `<h1>Récolte</h1>
    <p class="sous">Aucune campagne en cours.</p>
    <div class="verre vide-etat"><strong>Rien à récolter pour l’instant</strong>Démarre une campagne le jeudi de l’ouverture : l’app déroule ensuite ton plan, récolte par récolte.</div>
    <button class="btn principal" type="button" data-action="demarrer">Démarrer une campagne</button>`;
  }
  const plan = planCampagne(), n = plan.etapes.length, i = indexCourant();
  const debut = dateLocale(c.debut), fin = jourCampagne(c.debut, JOURS_CAMPAGNE - 1);
  const jour = Math.floor((dateLocale(isoJour(maintenant)) - debut) / 86400000) + 1;
  const position = jour < 1 ? "pas encore ouverte" : jour > JOURS_CAMPAGNE ? "terminée dans le jeu" : `jour${NB}${jour} sur${NB}${JOURS_CAMPAGNE}`;
  const sous = `<p class="sous">${majuscule(fmtLong(maintenant))}. Campagne du ${fmtDate(debut)} au ${fmtDate(fin)}, ${position}.</p>`;
  const annuler = i > 0 ? `<button class="lien" type="button" data-action="annuler-validation">Annuler la validation de «${NB}${e(plan.etapes[i - 1].nom)}${NB}»</button>` : "";

  if (i >= n) {
    return `<h1>Campagne terminée</h1>${sous}
    <div class="verre bloc"><div class="etat ok"><strong>Toutes les étapes sont validées</strong></div>
      <p class="petit">Clore la campagne l’enregistre dans l’historique et libère la place pour la suivante.</p>${annuler}</div>
    <button class="btn principal" type="button" data-action="clore">Clore la campagne</button>
    ${frise(plan, i)}`;
  }

  const etape = plan.etapes[i];
  const pret = pretA(c.debut, i, c.validations[i - 1]);
  const prete = maintenant >= pret;
  const precedente = i > 0
    ? `«${NB}${e(plan.etapes[i - 1].nom)}${NB}» validée ${quand(new Date(c.validations[i - 1]), maintenant)}.`
    : "La campagne s’ouvre le jeudi matin.";
  const bloc = prete
    ? `<div class="etat"><strong>Prête maintenant</strong><span class="petit num">depuis ${quand(pret, maintenant).replace(/^à /, "")}</span></div>`
    : `<div class="etat attente"><strong>Disponible ${quand(pret, maintenant)}</strong><span class="petit num">dans ${duree(pret - maintenant)}</span></div>`;
  const actions = etape.actions.length
    ? `<ul class="liste">${etape.actions.map(a => `<li><label><input type="checkbox" data-change="cocher" data-id="${a.id}"${c.coches[a.id] ? " checked" : ""}><span>${e(a.texte)}</span></label></li>`).join("")}</ul>`
    : `<p class="vide-etat">Aucune action dans cette étape. Ajoute-en depuis l’onglet Plan.</p>`;
  const btnValider = `<button class="btn${prete ? " principal" : ""}" type="button" data-action="valider">Valider «${NB}${e(etape.nom)}${NB}»</button>`;
  const btnRappel = `<button class="btn principal" type="button" data-action="rappel">Ajouter le rappel au calendrier</button>`;
  const suivante = plan.etapes[i + 1];
  const ensuite = suivante ? `<h2>Ensuite</h2>
    <div class="verre bloc">
      <h3>${e(suivante.nom)}, ${fmtJour(creneau(c.debut, i + 1))} ${moment(i + 1)}</h3>
      <p class="petit">Au plus tôt 10${NB}h après la validation, pas avant 8${NB}h.</p>
      <p style="margin-top:8px">${suivante.actions.map(a => e(a.texte)).join(". ")}${suivante.actions.length ? "." : ""}</p>
    </div>` : "";

  return `<h1>${e(etape.nom)}</h1>${sous}
  <div class="verre bloc">${bloc}<p class="petit">${precedente}</p>${annuler}</div>
  <div class="verre">${actions}</div>
  ${prete ? btnValider : btnRappel + btnValider}
  ${ensuite}
  ${frise(plan, i)}
  <button class="btn danger" type="button" data-action="clore">Clore la campagne maintenant</button>`;
}

// ---------- Vue : plan ----------

const CRAYON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>`;

function vuePlan() {
  if (!planDe(ui.planId)) ui.planId = etat.campagne?.planId ?? etat.plans[0].id;
  const plan = planDe(ui.planId), n = plan.etapes.length, c = etat.campagne;
  const enCampagne = c?.planId === plan.id;
  const courant = enCampagne ? indexCourant() : -1;
  const jourGenerique = i => fmtJour(jourCampagne("2026-11-12", Math.floor(i / 2)));

  const etapes = plan.etapes.map((etape, i) => {
    const valide = enCampagne && c.validations[i];
    const jour = enCampagne ? fmtJour(creneau(c.debut, i)) : jourGenerique(i);
    const moment2 = `${jour} ${moment(i)}${i >= 14 ? ", 2ᵉ" + NB + "semaine" : ""}`;
    const quandTexte = valide ? `validée ${fmtJour(new Date(valide))} à ${fmtHeure(new Date(valide))}` : moment2;
    const ouvert = ui.ouverts.has(i) || (ui.ouverts.size === 0 && i === courant);
    let corps;
    if (ui.editionPlan) {
      corps = `<ul class="liste">${etape.actions.map((a, k) => {
        const compris = resumerEffets(lireAction(a.texte));
        return `<li><span class="grandit">${e(a.texte)}<span class="detail">${compris ? "Compté : " + e(compris) : "Rien à compter dans la colonie"}</span></span>
          <button class="rond" type="button" data-action="editer-action" data-etape="${i}" data-k="${k}" aria-label="Modifier l’action : ${e(a.texte)}">${CRAYON}</button>
          <button class="rond retirer" type="button" data-action="retirer-action" data-etape="${i}" data-k="${k}" aria-label="Retirer l’action : ${e(a.texte)}">−</button></li>`;
      }).join("")}</ul>
      <div class="ajout"><button class="btn" type="button" data-action="ajouter-action" data-etape="${i}">Ajouter une action</button></div>`;
    } else if (enCampagne) {
      corps = `<ul class="liste">${etape.actions.map(a => `<li><label><input type="checkbox" data-change="cocher" data-id="${a.id}"${c.coches[a.id] ? " checked" : ""}><span>${e(a.texte)}</span></label></li>`).join("")}</ul>`;
    } else {
      corps = `<ul class="liste">${etape.actions.map(a => `<li>${e(a.texte)}</li>`).join("")}</ul>`;
    }
    return `<details data-i="${i}"${ouvert ? " open" : ""}>
      <summary><span class="rang ${i < courant ? "fait" : i === courant ? "cours" : ""}">${rang(i, n)}</span><span>${e(etape.nom)}<span class="quand">${quandTexte}</span></span></summary>
      ${corps}</details>`;
  }).join("");

  const supprimable = etat.plans.length > 1 && !enCampagne;
  const outils = ui.editionPlan ? `<div class="barre">
      <button class="btn mini" type="button" data-action="renommer-plan">Renommer</button>
      <button class="btn mini" type="button" data-action="dupliquer-plan">Dupliquer</button>
      ${supprimable ? `<button class="btn mini danger" type="button" data-action="supprimer-plan">Supprimer</button>` : ""}
    </div>` : "";

  return `<h1>Plan de campagne</h1>
  <p class="sous">${pluriel(n - 1, "récolte")} après la mise en place, deux par jour à partir du jeudi matin.${enCampagne ? " Plan de la campagne en cours." : ""}</p>
  <div class="barre">
    <select class="choix" data-change="choisir-plan" aria-label="Plan affiché">${etat.plans.map(p => `<option value="${p.id}"${p.id === plan.id ? " selected" : ""}>${e(p.nom)}</option>`).join("")}</select>
    <button class="btn mini" type="button" data-action="edition-plan" aria-pressed="${ui.editionPlan}">${ui.editionPlan ? "Terminer" : "Modifier"}</button>
  </div>
  ${outils}
  <div class="verre">${etapes}</div>
  <h2>Pistes à tester</h2>
  <div class="verre"><ul class="liste">
    <li><div>Dépasser 200${NB}% d’euphorie avant chaque récolte<span class="detail">Production ×1,5 au lieu de ×1,2. Source : aide InnoGames.</span></div></li>
    <li><div>Récolter les maisons une par une en remplaçant au fur et à mesure<span class="detail">Garde l’euphorie haute pendant toute la récolte. Source : Forge Addicts.</span></div></li>
    <li><div>Lancer toujours le lot le plus cher pour les biens et les unités<span class="detail">Moins cher à l’unité. Source : Les NRs.</span></div></li>
    <li><div>Remplacer les décorations de fin de campagne par des piloris<span class="detail">Les décorations réduiraient les actions générées. Source : Forge Addicts.</span></div></li>
  </ul></div>`;
}

// ---------- Vue : colonie ----------

function resultatEuphorie() {
  const r = euphorie(Number(etat.colonie.population), etat.colonie.points === "" ? NaN : Number(etat.colonie.points));
  if (!r) return `<p class="petit" style="margin-top:12px">Saisis les deux valeurs affichées dans le jeu pour connaître ton palier.</p>`;
  const pct = Math.round(r.pct), haut = r.coef === 1.5;
  const conseil = haut
    ? `Tu peux encore loger ${pluriel(r.habitantsPossibles, "habitant")} avant de repasser sous 200${NB}%.`
    : `Il manque ${pluriel(r.manque, "point")} d’euphorie pour passer Enthousiaste (production ×1,5).`;
  return `<div class="etat ${haut ? "ok" : "attente"}" style="margin-top:16px"><strong class="num">${pct}${NB}% d’euphorie</strong><span class="petit">${r.etat}, production ×${String(r.coef).replace(".", ",")}</span></div>
    <div class="jauge" role="img" aria-label="Euphorie à ${pct} %, palier Enthousiaste au-dessus de 200 %"><i style="width:${Math.min(100, r.pct / 2.5)}%"></i><u style="left:48%"></u><u style="left:56%"></u><u style="left:80%"></u></div>
    <div class="paliers num" aria-hidden="true"><span style="left:0;transform:none">0</span><span style="left:46%">120</span><span style="left:58%">140</span><span style="left:80%">200</span><span style="left:auto;right:0;transform:none">250</span></div>
    <p class="petit" style="margin-top:8px">${conseil}</p>`;
}

function vueColonie() {
  const calcul = `<div class="verre bloc">
    <h3>Euphorie</h3>
    <div class="deux">
      <label class="champ"><span>Population</span><input type="text" inputmode="numeric" data-input="population" value="${e(etat.colonie.population)}"></label>
      <label class="champ"><span>Points d’euphorie</span><input type="text" inputmode="numeric" data-input="points" value="${e(etat.colonie.points)}"></label>
    </div>
    <div id="resultat-euphorie" aria-live="polite">${resultatEuphorie()}</div>
  </div>`;
  if (!etat.campagne) {
    return `<h1>Colonie</h1><p class="sous">Aucune campagne en cours.</p>${calcul}
    <div class="verre vide-etat"><strong>Pas de bâtiments à compter</strong>Ils s’affichent ici dès qu’une campagne est démarrée et que des actions sont cochées.</div>`;
  }
  const plan = planCampagne(), { batiments, extensions } = etatColonie(plan, etat.campagne.coches);
  const familles = FAMILLES.map(f => {
    const lignes = BATIMENTS.filter(b => b.famille === f && batiments[b.cle] > 0)
      .map(b => `<li>${batiments[b.cle] > 1 ? b.pluriel : b.nom}<span class="valeur">${batiments[b.cle]}</span></li>`).join("");
    return lignes ? `<h2>${f}</h2><div class="verre"><ul class="liste">${lignes}</ul></div>` : "";
  }).join("");
  return `<h1>Colonie</h1>
  <p class="sous">Bâtiments en place d’après les actions cochées dans la campagne en cours.</p>
  ${calcul}
  ${familles || `<div class="verre vide-etat"><strong>Aucun bâtiment compté</strong>Coche les actions de la mise en place pour voir la colonie se remplir.</div>`}
  <h2>Terrain</h2>
  <div class="verre"><ul class="liste"><li>Extensions achetées<span class="valeur">${extensions}</span></li></ul></div>
  <p class="note">Les quantités libres («${NB}des piloris${NB}», «${NB}des décorations${NB}») ne sont pas comptées. Le détail de ce qui est compté se voit dans l’onglet Plan, bouton Modifier.</p>`;
}

// ---------- Vue : routines ----------

function vueRoutines() {
  const groupe = (periode, titre) => {
    const liste = etat.routines.filter(r => r.periode === periode);
    const faites = liste.filter(r => routineFaite(r)).length;
    const lignes = liste.map(r => `<li><label><input type="checkbox" data-change="routine" data-id="${r.id}"${routineFaite(r) ? " checked" : ""}><span>${e(r.texte)}</span></label>
      ${ui.editionRoutines ? `<button class="rond retirer" type="button" data-action="retirer-routine" data-id="${r.id}" aria-label="Retirer la routine : ${e(r.texte)}">−</button>` : ""}</li>`).join("");
    return `<div class="entete"><h2>${titre}</h2><span class="petit num">${liste.length ? `${faites} sur ${liste.length}` : ""}</span></div>
      <div class="verre">${lignes ? `<ul class="liste">${lignes}</ul>` : `<p class="vide-etat">Aucune routine ici pour l’instant.</p>`}</div>`;
  };
  return `<h1>Routines</h1>
  <p class="sous">Le reste du jeu, à cocher. Les cases se vident seules chaque jour, ou chaque lundi pour les routines de la semaine.</p>
  ${groupe("jour", "Chaque jour")}
  ${groupe("semaine", "Chaque semaine")}
  <button class="btn" type="button" data-action="ajouter-routine">Ajouter une routine</button>
  <button class="btn" type="button" data-action="edition-routines" aria-pressed="${ui.editionRoutines}">${ui.editionRoutines ? "Terminer" : "Retirer des routines"}</button>`;
}

// ---------- Vue : historique ----------

function vueHistorique() {
  const lignes = etat.historique.map((h, k) => {
    const debut = dateLocale(h.debut), fin = jourCampagne(h.debut, JOURS_CAMPAGNE - 1);
    return `<li><div class="grandit">${majuscule(fmtDate(debut))} au ${fmtDate(fin)} ${fin.getFullYear()}
      <span class="detail">${e(h.plan)}, ${pluriel(h.faites, "récolte")} sur ${h.total}</span>
      ${h.actions !== "" && h.actions != null ? `<span class="detail num">${Number(h.actions).toLocaleString("fr-FR")}${NB}action${h.actions > 1 ? "s" : ""} quantique${h.actions > 1 ? "s" : ""}</span>` : ""}
      ${h.note ? `<span class="detail">Note : ${e(h.note)}</span>` : ""}</div>
      <button class="rond retirer" type="button" data-action="retirer-campagne" data-k="${k}" aria-label="Supprimer la campagne du ${fmtDate(debut)}">−</button></li>`;
  }).join("");
  return `<h1>Historique</h1>
  <p class="sous">Une ligne par campagne close, pour comparer les variantes du plan.</p>
  <div class="verre">${lignes ? `<ul class="liste">${lignes}</ul>` : `<div class="vide-etat"><strong>Aucune campagne close</strong>Quand tu clos une campagne depuis l’onglet Récolte, elle s’ajoute ici avec ton total d’actions quantiques et ta note.</div>`}</div>
  <h2>Sauvegarde</h2>
  <p class="note" style="margin-top:0">Tes données restent sur cet appareil. Exporte un fichier de temps en temps pour ne rien perdre.</p>
  <button class="btn" type="button" data-action="exporter">Exporter une sauvegarde</button>
  <button class="btn" type="button" data-action="importer">Restaurer une sauvegarde</button>
  <input type="file" id="fichier" accept="application/json,.json" hidden>`;
}

// ---------- Rendu ----------

const VUES = { recolte: vueRecolte, plan: vuePlan, colonie: vueColonie, routines: vueRoutines, historique: vueHistorique };
const zone = document.getElementById("vue");
const fenetre = document.getElementById("fenetre");

function rendre() {
  document.querySelectorAll(".onglets button").forEach(b => b.dataset.vue === ui.vue ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  zone.innerHTML = VUES[ui.vue]();
}

// ---------- Fenêtre de saisie ----------

function demander({ titre, texte = "", champs = [], ok = "Enregistrer", danger = false }) {
  const champ = c => {
    const attrs = `name="${c.nom}"${c.requis ? " required" : ""}`;
    const saisie = c.type === "select"
      ? `<select ${attrs}>${c.options.map(([v, l]) => `<option value="${e(v)}"${v === c.valeur ? " selected" : ""}>${e(l)}</option>`).join("")}</select>`
      : c.type === "textarea" ? `<textarea ${attrs}>${e(c.valeur ?? "")}</textarea>`
      : `<input type="${c.type ?? "text"}" ${attrs} value="${e(c.valeur ?? "")}"${c.type === "number" ? ' inputmode="numeric" min="0"' : ""}>`;
    return `<label class="champ"><span>${e(c.label)}</span>${saisie}</label>`;
  };
  return new Promise(resoudre => {
    fenetre.innerHTML = `<form method="dialog"><h2 id="fenetre-titre">${e(titre)}</h2>${texte ? `<p class="petit">${e(texte)}</p>` : ""}
      ${champs.map(champ).join("")}
      <button class="btn ${danger ? "danger" : "principal"}" value="ok">${e(ok)}</button>
      <button class="btn" value="annuler" formnovalidate>Annuler</button></form>`;
    fenetre.returnValue = "";
    fenetre.onclose = () => resoudre(fenetre.returnValue === "ok" ? Object.fromEntries(new FormData(fenetre.querySelector("form"))) : null);
    fenetre.showModal();
  });
}

async function remettreFichier(fichier) {
  if (navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier] }); return; }
    catch (err) { if (err.name === "AbortError") return; }
  }
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = fichier.name;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}

// ---------- Actions ----------

const ACTIONS = {
  async demarrer() {
    const r = await demander({
      titre: "Démarrer une campagne", ok: "Démarrer",
      champs: [
        { nom: "debut", label: "Jeudi d’ouverture", type: "date", valeur: isoJour(dernierJeudi()), requis: true },
        { nom: "planId", label: "Plan à suivre", type: "select", valeur: etat.plans[0].id, options: etat.plans.map(p => [p.id, p.nom]) },
      ],
    });
    if (!r) return;
    etat.campagne = { debut: r.debut, planId: r.planId, coches: {}, validations: [] };
    ui.ouverts.clear();
  },
  valider() {
    etat.campagne.validations[indexCourant()] = new Date().toISOString();
    scrollTo(0, 0);
  },
  "annuler-validation"() {
    etat.campagne.validations[indexCourant() - 1] = null;
  },
  async rappel() {
    const c = etat.campagne, i = indexCourant(), etape = planCampagne().etapes[i];
    const texte = ics(`FOE : ${etape.nom}`, pretA(c.debut, i, c.validations[i - 1]), etape.actions.map(a => a.texte).join("\n"));
    await remettreFichier(new File([texte], "recolte-foe.ics", { type: "text/calendar" }));
  },
  async clore() {
    const c = etat.campagne, plan = planCampagne(), n = plan.etapes.length;
    const r = await demander({
      titre: "Clore la campagne", ok: "Clore et archiver",
      texte: "Elle passe dans l’historique et l’onglet Récolte repart de zéro.",
      champs: [
        { nom: "actions", label: "Actions quantiques dépensées (facultatif)", type: "number" },
        { nom: "note", label: "Note pour la prochaine fois (facultatif)", type: "textarea" },
      ],
    });
    if (!r) return;
    etat.historique.unshift({ debut: c.debut, plan: plan.nom, faites: c.validations.slice(1, n).filter(Boolean).length, total: n - 1, actions: r.actions, note: r.note.trim() });
    etat.campagne = null;
    ui.vue = "historique";
  },

  "edition-plan"() { ui.editionPlan = !ui.editionPlan; },
  async "renommer-plan"() {
    const plan = planDe(ui.planId);
    const r = await demander({ titre: "Renommer le plan", champs: [{ nom: "nom", label: "Nom du plan", valeur: plan.nom, requis: true }] });
    if (r?.nom.trim()) plan.nom = r.nom.trim();
  },
  async "dupliquer-plan"() {
    const plan = planDe(ui.planId);
    const r = await demander({ titre: "Dupliquer le plan", ok: "Créer la variante", champs: [{ nom: "nom", label: "Nom de la variante", valeur: plan.nom + " (variante)", requis: true }] });
    if (!r?.nom.trim()) return;
    const copie = { id: id(), nom: r.nom.trim(), etapes: plan.etapes.map(et => ({ nom: et.nom, actions: et.actions.map(a => ({ id: id(), texte: a.texte })) })) };
    etat.plans.push(copie);
    ui.planId = copie.id;
  },
  async "supprimer-plan"() {
    const plan = planDe(ui.planId);
    const r = await demander({ titre: `Supprimer «${NB}${plan.nom}${NB}» ?`, texte: "Le plan et ses actions sont effacés de cet appareil. Les campagnes déjà closes restent dans l’historique.", ok: "Supprimer le plan", danger: true });
    if (!r) return;
    etat.plans = etat.plans.filter(p => p.id !== plan.id);
    ui.planId = null;
  },
  async "ajouter-action"(d) {
    const r = await demander({ titre: "Ajouter une action", ok: "Ajouter", texte: "Écris-la comme dans ton plan : « Vendre 2 tanneries, poser 1 boulangerie ».", champs: [{ nom: "texte", label: "Action", requis: true }] });
    if (r?.texte.trim()) planDe(ui.planId).etapes[d.etape].actions.push({ id: id(), texte: r.texte.trim() });
  },
  async "editer-action"(d) {
    const action = planDe(ui.planId).etapes[d.etape].actions[d.k];
    const r = await demander({ titre: "Modifier l’action", champs: [{ nom: "texte", label: "Action", valeur: action.texte, requis: true }] });
    if (r?.texte.trim()) action.texte = r.texte.trim();
  },
  "retirer-action"(d) {
    planDe(ui.planId).etapes[d.etape].actions.splice(d.k, 1);
  },

  "edition-routines"() { ui.editionRoutines = !ui.editionRoutines; },
  async "ajouter-routine"() {
    const r = await demander({
      titre: "Ajouter une routine", ok: "Ajouter",
      champs: [
        { nom: "texte", label: "À faire", requis: true },
        { nom: "periode", label: "Fréquence", type: "select", valeur: "jour", options: [["jour", "Chaque jour"], ["semaine", "Chaque semaine"]] },
      ],
    });
    if (r?.texte.trim()) etat.routines.push({ id: id(), texte: r.texte.trim(), periode: r.periode, faitLe: null });
  },
  "retirer-routine"(d) { etat.routines = etat.routines.filter(r => r.id !== d.id); },

  async "retirer-campagne"(d) {
    const r = await demander({ titre: "Supprimer cette campagne de l’historique ?", texte: "Son résultat et sa note sont effacés de cet appareil.", ok: "Supprimer", danger: true });
    if (r) etat.historique.splice(d.k, 1);
  },
  async exporter() {
    await remettreFichier(new File([JSON.stringify(etat, null, 1)], `suivi-foe-${isoJour(new Date())}.json`, { type: "application/json" }));
  },
  importer() { document.getElementById("fichier").click(); },
};

const CHANGEMENTS = {
  cocher(el) {
    if (el.checked) etat.campagne.coches[el.dataset.id] = true; else delete etat.campagne.coches[el.dataset.id];
    return false; // la case suffit, pas besoin de redessiner
  },
  routine(el) { etat.routines.find(r => r.id === el.dataset.id).faitLe = el.checked ? new Date().toISOString() : null; },
  "choisir-plan"(el) { ui.planId = el.value; ui.ouverts.clear(); },
};

zone.addEventListener("click", async ev => {
  const bouton = ev.target.closest("[data-action]");
  if (!bouton) return;
  await ACTIONS[bouton.dataset.action](bouton.dataset);
  sauver();
  rendre();
});

zone.addEventListener("change", async ev => {
  const el = ev.target;
  if (el.id === "fichier") return restaurer(el.files[0]);
  const fn = CHANGEMENTS[el.dataset.change];
  if (!fn) return;
  const redessiner = fn(el) !== false;
  sauver();
  if (redessiner) rendre();
});

zone.addEventListener("input", ev => {
  const champ = ev.target.dataset.input;
  if (!champ) return;
  etat.colonie[champ] = ev.target.value.replace(/[^\d]/g, "");
  sauver();
  document.getElementById("resultat-euphorie").innerHTML = resultatEuphorie();
});

zone.addEventListener("toggle", ev => {
  const i = Number(ev.target.dataset?.i);
  if (Number.isNaN(i)) return;
  if (ui.ouverts.size === 0) zone.querySelectorAll("details[open]").forEach(d => ui.ouverts.add(Number(d.dataset.i)));
  ev.target.open ? ui.ouverts.add(i) : ui.ouverts.delete(i);
  if (ui.ouverts.size === 0) ui.ouverts.add(-1); // tout est replié : ne pas rouvrir l'étape en cours
}, true);

async function restaurer(fichier) {
  if (!fichier) return;
  let lu;
  try { lu = JSON.parse(await fichier.text()); } catch { lu = null; }
  if (lu?.v !== 1 || !Array.isArray(lu.plans) || !lu.plans.length) {
    await demander({ titre: "Fichier non reconnu", texte: "Ce fichier n’est pas une sauvegarde de Suivi FOE. Choisis un fichier « suivi-foe-….json » exporté depuis cet onglet.", ok: "Compris" });
    return;
  }
  const r = await demander({ titre: "Restaurer cette sauvegarde ?", texte: "Elle remplace toutes les données actuelles de cet appareil : plans, campagne en cours, routines et historique.", ok: "Remplacer mes données", danger: true });
  if (!r) return;
  etat = lu;
  sauver();
  rendre();
}

document.querySelector(".onglets").addEventListener("click", ev => {
  const b = ev.target.closest("button");
  if (!b) return;
  ui.vue = b.dataset.vue;
  rendre();
  scrollTo(0, 0);
});

// L'heure avance : la récolte devient prête sans qu'on touche à rien.
const rafraichir = () => {
  if (ui.vue === "recolte" && !fenetre.open && !document.hidden) rendre();
};
setInterval(rafraichir, 30000);
document.addEventListener("visibilitychange", rafraichir);

if (ETAPES_MAX < Math.max(...etat.plans.map(p => p.etapes.length))) console.warn("Un plan dépasse les 22 créneaux d’une campagne.");
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js");

rendre();
