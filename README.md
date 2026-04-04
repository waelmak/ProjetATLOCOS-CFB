# CFB Kamsar — Dashboard Avancement
## Procédure de déploiement (GitHub Pages + Google Sheets)

---

## ÉTAPE 1 — Préparer le Google Sheet

1. Va sur **sheets.google.com** → ouvre ton fichier Excel existant (ou crée-en un nouveau)
2. **Importer l'Excel** : Fichier → Importer → uploade `rapport_S22_CFB_Kamsar_v2.xlsx`
3. **Rendre public** : Partager → "Tout le monde avec le lien" → Lecteur → Copier le lien
4. **Récupère le Sheet ID** : dans l'URL entre `/d/` et `/edit`
   ```
   https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXXX/edit
                                          ^^^^^^^^^^^^^^^^^^^^^^^^
                                          C'est ton SHEET_ID
   ```

---

## ÉTAPE 2 — Configurer le dashboard

Ouvre `config.js` et remplace :
```js
SHEET_ID: "REMPLACER_PAR_TON_SHEET_ID",
```
par ton vrai Sheet ID.

---

## ÉTAPE 3 — Déployer sur GitHub Pages

1. Va sur **github.com** → créer un nouveau repository public (ex: `cfb-dashboard`)
2. Uploade tous les fichiers :
   - `index.html`
   - `config.js`
   - `data.js`
3. Dans le repo → **Settings** → **Pages** → Source : `main` / `root` → **Save**
4. Ton lien : `https://ton-username.github.io/cfb-dashboard`

---

## MISE À JOUR CHAQUE SEMAINE

1. Ouvre ton **Google Sheet** directement
2. Modifie les cellules de la feuille `INFO` (Avancement_reel, SPI, etc.)
3. Mets à jour la colonne `Reel` dans `COURBE_S`
4. Le dashboard se met à jour **automatiquement** pour tout le monde — rien à redéployer

---

## STRUCTURE DES FICHIERS

```
cfb-dashboard/
├── index.html     ← Dashboard public
├── config.js      ← ⚠️ METTRE TON SHEET ID ICI
└── data.js        ← Lecture Google Sheets (ne pas modifier)
```
