// ═══════════════════════════════════════════════════════
// DATA.JS — Lecture Google Sheets via API publique
// ═══════════════════════════════════════════════════════

const GS = {
  // Fetch a sheet as array of objects
  async fetch(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    try {
      const res  = await fetch(url);
      const text = await res.text();
      // Google wraps JSON in /*O_o*/google.visualization.Query.setResponse(...)
      const json = JSON.parse(text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/)[1]);
      return GS.parseTable(json.table);
    } catch(e) {
      console.warn(`Sheet "${sheetName}" error:`, e.message);
      return [];
    }
  },

  // Convert gviz table to array of objects
  parseTable(table) {
    if (!table || !table.rows) return [];
    const cols = table.cols.map(c => (c.label || '').trim());
    return table.rows.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        const cell = row.c ? row.c[i] : null;
        obj[col] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== '' && v !== null));
  },

  // Parse INFO sheet (key-value pairs)
  parseInfo(rows) {
    const obj = {};
    rows.forEach(row => {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        const k = String(row[keys[0]] || '').trim();
        const v = row[keys[1]];
        if (k && k.length < 35) obj[k] = v;
      }
    });
    return obj;
  },

  // Parse S-Curve sheet
  parseCourbe(rows) {
    return rows.map(r => {
      const sem  = String(r['Semaine'] || r['semaine'] || '');
      const plan = parseFloat(r['Prevu'] || r['prevu'] || 0);
      const rv   = r['Reel'] !== undefined ? r['Reel'] : r['reel'];
      const reel = (rv === null || rv === undefined || rv === '') ? null : parseFloat(rv);
      return { sem, plan, reel: isNaN(reel) ? null : reel };
    }).filter(r => r.sem && r.sem !== 'Semaine');
  },

  // Parse disciplines
  parseDisciplines(rows) {
    return rows.map(r => ({
      nom  : String(r['Discipline'] || r['discipline'] || ''),
      plan : parseFloat(r['Prevu']  || r['prevu']  || 0),
      reel : parseFloat(r['Reel']   || r['reel']   || 0),
      poids: parseFloat(r['Poids']  || r['poids']  || 0),
    })).filter(r => r.nom && r.nom !== 'Discipline');
  },

  // Parse jalons
  parseJalons(rows) {
    return rows.map(r => ({
      nom    : String(r['Nom du Jalon'] || r['Nom'] || r['nom'] || r['Jalon de Contrôle'] || ''),
      date   : String(r['Date'] || r['date'] || ''),
      debut_p: String(r['Début Planifié'] || r['Début Prévu'] || ''),
      fin_p  : String(r['Fin Planifiée']  || r['Fin Prévue']  || ''),
      debut_r: String(r['Début Réel']     || ''),
      fin_r  : String(r['Fin Réelle']     || ''),
      tf     : parseFloat(r['Retard (TF)'] || r['TF (jours)'] || 0),
      statut : String(r['Statut'] || r['statut'] || 'future'),
      poids  : parseFloat(r['Poids (%)'] || r['Poids'] || 0),
      montant: parseFloat(r['Montant ($)'] || r['Montant'] || 0),
    })).filter(r => r.nom && r.nom !== 'Nom du Jalon' && r.nom !== 'Jalon de Contrôle');
  },

  // Parse KPI sheet (quantités)
  parseKpi(rows) {
    return rows.map(r => ({
      nom    : String(r['Indicateur'] || r['DÉSIGNATION'] || r['Désignation'] || ''),
      exec_  : parseFloat(r['Valeur Exécutée'] || r['QTÉ EXÉCUTÉE (m³)'] || 0),
      total  : parseFloat(r['Valeur Totale']   || r['QTÉ TOTALE (m³)']   || 1),
      obs    : String(r['Observation'] || ''),
    })).filter(r => r.nom && r.nom !== 'Indicateur' && r.nom !== 'DÉSIGNATION' && r.nom.length > 1);
  },

  // Load ALL data at once
  async loadAll() {
    const S = CONFIG.SHEETS;
    const [
      infoRows, courbeRows, discRows, jalonRows,
      terrQteRows, terrJalRows, pieuxKpiRows, pieuxJalRows,
      fondKpiRows, fondJalRows, vrdKpiRows, vrdJalRows,
      engRows, approRows,
      cTerrRows, cPieuxRows, cFondRows, cVrdRows, cCharpRows
    ] = await Promise.all([
      GS.fetch(S.info),       GS.fetch(S.courbe),      GS.fetch(S.disciplines),
      GS.fetch(S.jalons),     GS.fetch(S.terrQte),     GS.fetch(S.terrJal),
      GS.fetch(S.pieuxKpi),   GS.fetch(S.pieuxJal),    GS.fetch(S.fondKpi),
      GS.fetch(S.fondJal),    GS.fetch(S.vrdKpi),      GS.fetch(S.vrdJal),
      GS.fetch(S.engineering),GS.fetch(S.appro),
      GS.fetch(S.courbeTerr), GS.fetch(S.courbePieux), GS.fetch(S.courbeFond),
      GS.fetch(S.courbeVrd),  GS.fetch(S.courbeCharp),
    ]);

    const info = GS.parseInfo(infoRows);
    return {
      projet       : String(info['Projet'] || 'CFB Kamsar'),
      semaine      : String(info['Semaine'] || '—'),
      date         : String(info['Date'] || ''),
      reel_pct     : parseFloat(info['Avancement_reel']  || 0),
      plan_pct     : parseFloat(info['Avancement_prevu'] || 0),
      spi          : parseFloat(info['SPI']  || 1),
      cpi          : parseFloat(info['CPI']  || 1),
      bcwp         : parseFloat(info['BCWP'] || 0),
      bcws         : parseFloat(info['BCWS'] || 0),
      bac          : parseFloat(info['BAC']  || 0),
      acwp         : parseFloat(info['ACWP'] || 0),
      commentaire  : String(info['Commentaire'] || ''),
      photos       : [],
      courbe               : GS.parseCourbe(courbeRows),
      disciplines          : GS.parseDisciplines(discRows),
      jalons               : GS.parseJalons(jalonRows),
      terr_qte             : GS.parseKpi(terrQteRows),
      terr_jalons          : GS.parseJalons(terrJalRows),
      pieux_kpi            : GS.parseKpi(pieuxKpiRows),
      pieux_jalons         : GS.parseJalons(pieuxJalRows),
      fond_kpi             : GS.parseKpi(fondKpiRows),
      fond_jalons          : GS.parseJalons(fondJalRows),
      vrd_kpi              : GS.parseKpi(vrdKpiRows),
      vrd_jalons           : GS.parseJalons(vrdJalRows),
      engineering          : engRows,
      appro                : approRows,
      courbe_terrassement  : GS.parseCourbe(cTerrRows),
      courbe_pieux         : GS.parseCourbe(cPieuxRows),
      courbe_fondation     : GS.parseCourbe(cFondRows),
      courbe_vrd           : GS.parseCourbe(cVrdRows),
      courbe_charpente     : GS.parseCourbe(cCharpRows),
      updatedAt            : new Date().toISOString(),
    };
  }
};
