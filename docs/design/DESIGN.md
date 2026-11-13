# Design de Suivi FOE

Direction demandée par Jérém le 13/11/2026 : esprit iOS « Liquid Glass », couleurs de Forge of Empires, fond uni
bleu marine (les disques de couleur de la première maquette ont été refusés). Maquette de référence :
`maquette/index.html`. App pensée pour l'iPhone ; sur grand écran elle reste une colonne de 460 px centrée.

```yaml
couleurs:
  fond: "#0c1a33"          # marine uni, aucun motif ni dégradé
  texte: "#ffffff"         # blanc pur (demande du 13/11)
  texte-2: "#e3e8f2"       # texte secondaire
  or: "#ffc20e"            # action principale et étape en cours, une seule par vue
  sur-or: "#171100"        # texte sur l'or
  vert: "#7fd69a"          # fait, palier atteint
  rouge: "#ff9a88"         # suppression uniquement
verre:
  remplissage: "rgba(255,255,255,.07)"
  filet: "rgba(255,255,255,.16)"
  reflet: "inset 0 1px 0 rgba(255,255,255,.22)"
  flou: "blur(28px) saturate(160%)"
rayons: { panneau: 26px, champ: 14px, bouton: capsule, case-frise: 9px }
typo:
  famille: police système (San Francisco sur iPhone), choisie pour le rendu iOS
  tailles: { titre: 34px, section: 20px, corps: 17px, secondaire: 15px, minimum: 13px }
zones-de-clic: 36px minimum, 52px pour les boutons et les onglets
ombre: uniquement sous la barre d'onglets flottante et la fenêtre de saisie
```

Élément propre à l'app : la frise de campagne (11 jours, ligne du matin et ligne du soir).
Contrastes mesurés avec `contraste.py` sur verre : texte 14,4:1, secondaire 11,7:1, or 8,9:1, rouge 7:1.
