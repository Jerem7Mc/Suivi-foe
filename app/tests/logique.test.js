import { test } from "node:test";
import assert from "node:assert/strict";
import { lireAction, resumerEffets, etatColonie, planDeBase, creneau, pretA, dernierJeudi, routineFaite, euphorie, ics } from "../logique.js";

test("lit ventes et poses avec leurs quantités", () => {
  assert.deepEqual(lireAction("Vendre 3 tanneries, poser 1 cordonnier").deltas, { tannerie: -3, cordonnier: 1 });
  assert.deepEqual(lireAction("Poser 3 églises, 2 palais, 5 maisons à étages, 2 propriétés, 8 tanneries, 3 brasseries").deltas,
    { eglise: 3, palais: 2, "maison-etages": 5, propriete: 2, tannerie: 8, brasserie: 3 });
  assert.deepEqual(lireAction("Poser 1 maison en bois, vendre les 2 dernières maisons à étages").deltas, { "maison-bois": 1, "maison-etages": -2 });
});

test("comprend les articles et ignore les quantités libres", () => {
  assert.deepEqual(lireAction("Vendre la dernière église, poser 1 médecin").deltas, { eglise: -1, medecin: 1 });
  assert.deepEqual(lireAction("Vendre le cordonnier, poser 1 boulangerie").deltas, { cordonnier: -1, boulangerie: 1 });
  assert.deepEqual(lireAction("Vendre la bibliothèque, la remplacer par des piloris").deltas, { bibliotheque: -1 });
  assert.deepEqual(lireAction("1 h plus tard : extension (90), revendre l’apiculture").deltas, { apiculture: -1 });
  assert.deepEqual(lireAction("Compléter l’euphorie avec des potences").deltas, {});
});

test("un verbe neutre ne compte pas le bâtiment qui le suit", () => {
  assert.deepEqual(lireAction("Booster le cordonnier pour poser 1 boulangerie").deltas, { boulangerie: 1 });
  assert.deepEqual(lireAction("Faire les unités, puis revendre la caserne").deltas, { caserne: -1 });
  assert.deepEqual(lireAction("Choisir les casernes : artillerie et 2 autres").deltas, {});
});

test("compte les extensions faites, pas celles en préparation", () => {
  assert.equal(lireAction("Faire une extension (130)").extensions, 1);
  assert.equal(lireAction("Prendre 1 extension en cuivre et 2 extensions en éclats (100 et 150)").extensions, 3);
  assert.equal(lireAction("1 h plus tard : extension (60), revendre la manufacture, poser l’apiculture").extensions, 1);
  assert.equal(lireAction("Commencer une extension").extensions, 0);
  assert.equal(lireAction("Continuer les ressources de l’extension").extensions, 0);
  assert.equal(lireAction("Poser 1 corderie pour les prochaines extensions").extensions, 0);
  assert.equal(lireAction("Commencer les ressources de la prochaine extension").extensions, 0);
});

test("résume ce qui a été compris", () => {
  assert.equal(resumerEffets(lireAction("Vendre 3 tanneries, poser 1 cordonnier")), "−3 tanneries, +1 cordonnier");
  assert.equal(resumerEffets(lireAction("Tout vendre")), "tout est vendu");
  assert.equal(resumerEffets(lireAction("Poser un bâtiment culturel")), "");
});

test("état de la colonie après la 2e récolte du plan de base", () => {
  const plan = planDeBase();
  const coches = {};
  plan.etapes.slice(0, 3).forEach(e => e.actions.forEach(a => coches[a.id] = true));
  const { batiments, extensions } = etatColonie(plan, coches);
  assert.equal(extensions, 5);
  assert.deepEqual(batiments, {
    eglise: 3, palais: 0, "maison-etages": 5, propriete: 2, tannerie: 4, brasserie: 3,
    cordonnier: 1, boulangerie: 1, bibliotheque: 2, "maison-charpente": 1, poudre: 0, apiculture: 0,
  });
});

test("plan de base complet : tout vendu à la fin, jamais de quantité négative", () => {
  const plan = planDeBase();
  const coches = {};
  plan.etapes.forEach(e => e.actions.forEach(a => coches[a.id] = true));
  const { batiments, extensions } = etatColonie(plan, coches);
  assert.ok(Object.values(batiments).every(n => n === 0));
  assert.equal(extensions, 12);
  assert.equal(plan.etapes.length, 20);
});

test("bâtiments notés à la main : comptés à leur étape, effacés par « tout vendre »", () => {
  const plan = planDeBase();
  const coches = {};
  plan.etapes.slice(0, 4).forEach(e => e.actions.forEach(a => coches[a.id] = true));
  const ajouts = [{ etape: 3, cle: "pilori", n: 1 }, { etape: 3, cle: "decoration", n: 2 }, { etape: 2, cle: "tannerie", n: -1 }];
  const { batiments } = etatColonie(plan, coches, ajouts);
  assert.equal(batiments.pilori, 1);
  assert.equal(batiments.decoration, 2);
  assert.equal(batiments.tannerie, 3);
  plan.etapes.forEach(e => e.actions.forEach(a => coches[a.id] = true));
  assert.equal(etatColonie(plan, coches, ajouts).batiments.pilori, 0);
  assert.deepEqual(lireAction("Poser 2 décorations").deltas, { decoration: 2 });
});

test("créneaux : matin 8 h, soir 18 h, deux par jour", () => {
  assert.equal(creneau("2026-11-12", 0).toString(), new Date(2026, 10, 12, 8).toString());
  assert.equal(creneau("2026-11-12", 3).toString(), new Date(2026, 10, 13, 18).toString());
  assert.equal(creneau("2026-11-12", 19).toString(), new Date(2026, 10, 21, 18).toString());
});

test("prête 10 h après la validation précédente, jamais avant 8 h", () => {
  const matin = new Date(2026, 10, 13, 8, 14);
  assert.equal(pretA("2026-11-12", 3, matin.toISOString()).toString(), new Date(2026, 10, 13, 18, 14).toString());
  const soir = new Date(2026, 10, 13, 20, 31);
  assert.equal(pretA("2026-11-12", 4, soir.toISOString()).toString(), new Date(2026, 10, 14, 8, 0).toString());
  const tard = new Date(2026, 10, 13, 23, 0);
  assert.equal(pretA("2026-11-12", 4, tard.toISOString()).toString(), new Date(2026, 10, 14, 9, 0).toString());
  assert.equal(pretA("2026-11-12", 0, null).toString(), new Date(2026, 10, 12, 8).toString());
});

test("dernier jeudi", () => {
  assert.equal(dernierJeudi(new Date(2026, 10, 13, 21)).toString(), new Date(2026, 10, 12).toString());
  assert.equal(dernierJeudi(new Date(2026, 10, 12, 7)).toString(), new Date(2026, 10, 12).toString());
  assert.equal(dernierJeudi(new Date(2026, 10, 18)).toString(), new Date(2026, 10, 12).toString());
});

test("routines : remise à zéro chaque jour ou chaque lundi", () => {
  const vendredi = new Date(2026, 10, 13, 9);
  assert.equal(routineFaite({ periode: "jour", faitLe: vendredi.toISOString() }, new Date(2026, 10, 13, 23)), true);
  assert.equal(routineFaite({ periode: "jour", faitLe: vendredi.toISOString() }, new Date(2026, 10, 14, 0, 5)), false);
  assert.equal(routineFaite({ periode: "semaine", faitLe: vendredi.toISOString() }, new Date(2026, 10, 15, 23)), true);
  assert.equal(routineFaite({ periode: "semaine", faitLe: vendredi.toISOString() }, new Date(2026, 10, 16, 1)), false);
  assert.equal(routineFaite({ periode: "jour", faitLe: null }), false);
  // Expédition de guilde : la semaine repart le mardi.
  assert.equal(routineFaite({ periode: "semaine", debut: 2, faitLe: vendredi.toISOString() }, new Date(2026, 10, 16, 23)), true);
  assert.equal(routineFaite({ periode: "semaine", debut: 2, faitLe: vendredi.toISOString() }, new Date(2026, 10, 17, 0, 5)), false);
  assert.equal(routineFaite({ periode: "semaine", debut: 2, faitLe: new Date(2026, 10, 16, 9).toISOString() }, new Date(2026, 10, 17, 9)), false);
});

test("paliers d'euphorie", () => {
  assert.deepEqual(euphorie(100, 200), { pct: 200, coef: 1.2, etat: "Heureux", manque: 1, habitantsPossibles: 0 });
  assert.deepEqual(euphorie(100, 212), { pct: 212, coef: 1.5, etat: "Enthousiaste", manque: 0, habitantsPossibles: 5 });
  assert.equal(euphorie(100, 15).etat, "Rébellion");
  assert.equal(euphorie(100, 121).coef, 1.1);
  assert.equal(euphorie(0, 50), null);
});

test("rappel de calendrier", () => {
  const texte = ics("4ᵉ récolte, FOE", new Date(Date.UTC(2026, 10, 14, 7, 0)), "Poser 1 maison en bois; vendre", new Date(Date.UTC(2026, 10, 13, 19, 31)));
  assert.match(texte, /DTSTART:20261114T070000Z/);
  assert.match(texte, /DTEND:20261114T071500Z/);
  assert.match(texte, /SUMMARY:4ᵉ récolte\\, FOE/);
  assert.match(texte, /DESCRIPTION:Poser 1 maison en bois\\; vendre/);
  assert.match(texte, /TRIGGER:PT0M/);
  assert.ok(texte.includes("\r\n"));
});
