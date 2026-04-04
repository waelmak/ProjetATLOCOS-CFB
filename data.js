// ═══════════════════════════════════════════════════════
// DATA.JS — Lecture Google Sheets via API gviz
// Parsing par INDEX de colonne — robuste aux lignes de bannière
// ═══════════════════════════════════════════════════════

const GS = {

  // Fetch raw gviz rows from a sheet
  async fetchRows(sheetName) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      const res  = await fetch(url);
      const text = await res.text();
      const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
      if (!m) { console.warn(`[GS] "${sheetName}": format inattendu`); return []; }
      const table = JSON.parse(m[1]).table;
      return table && table.rows ? table.rows : [];
    } catch(e) {
      console.warn(`[GS] "${sheetName}": ${e.message}`);
      return [];
    }
  },

  // Safe cell value
  v(cell) {
    if (!cell || cell.v === null || cell.v === undefined) return null;
    return cell.v;
  },
  s(cell) { const v = GS.v(cell); return v !== null ? String(v).trim() : ''; },
  n(cell) { const v = GS.v(cell); if (v === null || v === '') return null; const n = parseFloat(v); return isNaN(n) ? null : n; },

  // ── PARSE COURBE_S ──────────────────────────────────────
  // Find rows where col[0] matches S1..S99
  parseCourbe(rows) {
    const out = [];
    for (const row of rows) {
      const cells = row.c || [];
      const sem = GS.s(cells[0]);
      if (!/^S\d+$/i.test(sem.trim())) continue;   // only rows like S1, S2...
      const plan = GS.n(cells[1]);
      const reel = GS.n(cells[2]);
      out.push({
        sem:  sem.trim().toUpperCase(),
        plan: plan ?? 0,
        reel: reel,   // null = future
      });
    }
    console.log(`[GS] COURBE: ${out.length} semaines, réel jusqu'à`, out.filter(r=>r.reel!==null).slice(-1)[0]?.sem || 'aucune');
    return out;
  },

  // ── PARSE INFO ──────────────────────────────────────────
  // Key-value pairs: col[0]=key, col[1]=value
  parseInfo(rows) {
    const obj = {};
    const KNOWN = ['Projet','Semaine','Date','Avancement_reel','Avancement_prevu',
                   'SPI','CPI','BAC','BCWP','BCWS','ACWP','Commentaire'];
    for (const row of rows) {
      const cells = row.c || [];
      const k = GS.s(cells[0]);
      const v = GS.v(cells[1]);
      if (!k || v === null || v === undefined || v === '') continue;
      if (KNOWN.includes(k)) obj[k] = v;
    }
    console.log('[GS] INFO:', JSON.stringify(obj));
    return obj;
  },

  // ── PARSE DISCIPLINES ───────────────────────────────────
  // [0]=Nom [1]=Prevu [2]=Reel [3]=Poids
  parseDisciplines(rows) {
    const out = [];
    for (const row of rows) {
      const cells = row.c || [];
      const nom = GS.s(cells[0]);
      if (!nom || nom.length < 3 || /^(discipline|total)/i.test(nom)) continue;
      out.push({
        nom,
        plan : GS.n(cells[1]) ?? 0,
        reel : GS.n(cells[2]) ?? 0,
        poids: GS.n(cells[3]) ?? 0,
      });
    }
    return out;
  },

  // ── PARSE JALONS CONTRACTUELS ───────────────────────────
  // [0]=# [1]=Nom [2]=Poids [3]=Montant [4]=Statut
  parseJalons(rows) {
    const out = [];
    for (const row of rows) {
      const cells = row.c || [];
      const c0 = GS.v(cells[0]);
      const nom = GS.s(cells[1]);
      if (!nom || nom.length < 3) continue;
      if (/^(nom du jalon|total)/i.test(nom)) continue;
      out.push({
        nom,
        poids  : GS.n(cells[2]) ?? 0,
        montant: GS.n(cells[3]) ?? 0,
        statut : GS.s(cells[4]) || 'future',
        debut_p:'', fin_p:'', debut_r:'', fin_r:'', tf:0,
      });
    }
    return out;
  },

  // ── PARSE JALONS DE CONTRÔLE ────────────────────────────
  // [0]=Nom [1]=DebutP [2]=FinP [3]=DebutR [4]=FinR [5]=TF [6]=Statut
  parseJalonsControl(rows) {
    const out = [];
    for (const row of rows) {
      const cells = row.c || [];
      const nom = GS.s(cells[0]);
      if (!nom || nom.length < 3) continue;
      if (/^(jalon de contrôle|total)/i.test(nom)) continue;
      out.push({
        nom,
        debut_p: GS.s(cells[1]),
        fin_p  : GS.s(cells[2]),
        debut_r: GS.s(cells[3]),
        fin_r  : GS.s(cells[4]),
        tf     : GS.n(cells[5]) ?? 0,
        statut : GS.s(cells[6]) || 'future',
        poids:0, montant:0,
      });
    }
    return out;
  },

  // ── PARSE KPI (quantités) ───────────────────────────────
  // [0]=Nom [1]=Exec [2]=Total [3]=Obs
  parseKpi(rows) {
    const out = [];
    for (const row of rows) {
      const cells = row.c || [];
      const nom = GS.s(cells[0]);
      if (!nom || nom.length < 2) continue;
      if (/^(indicateur|désignation|total)/i.test(nom)) continue;
      const exec_ = GS.n(cells[1]) ?? 0;
      const total = GS.n(cells[2]) ?? 1;
      if (total < 1) continue;
      out.push({ nom, exec_, total, obs: GS.s(cells[3]) });
    }
    return out;
  },

  // ── LOAD ALL ────────────────────────────────────────────
  async loadAll() {
    const S = CONFIG.SHEETS;

    const [
      infoRows, courbeRows, discRows, jalonRows,
      terrQteRows, terrJalRows, pieuxKpiRows, pieuxJalRows,
      fondKpiRows, fondJalRows, vrdKpiRows, vrdJalRows,
      engRows, approRows,
      cTerrRows, cPieuxRows, cFondRows, cVrdRows, cCharpRows
    ] = await Promise.all([
      GS.fetchRows(S.info),        GS.fetchRows(S.courbe),       GS.fetchRows(S.disciplines),
      GS.fetchRows(S.jalons),      GS.fetchRows(S.terrQte),      GS.fetchRows(S.terrJal),
      GS.fetchRows(S.pieuxKpi),    GS.fetchRows(S.pieuxJal),     GS.fetchRows(S.fondKpi),
      GS.fetchRows(S.fondJal),     GS.fetchRows(S.vrdKpi),       GS.fetchRows(S.vrdJal),
      GS.fetchRows(S.engineering), GS.fetchRows(S.appro),
      GS.fetchRows(S.courbeTerr),  GS.fetchRows(S.courbePieux),  GS.fetchRows(S.courbeFond),
      GS.fetchRows(S.courbeVrd),   GS.fetchRows(S.courbeCharp),
    ]);

    const info = GS.parseInfo(infoRows);

    return {
      projet      : String(info['Projet'] || 'CFB Kamsar'),
      semaine     : String(info['Semaine'] || '—'),
      date        : String(info['Date'] || ''),
      reel_pct    : parseFloat(info['Avancement_reel']  || 0),
      plan_pct    : parseFloat(info['Avancement_prevu'] || 0),
      spi         : parseFloat(info['SPI']  || 1),
      cpi         : parseFloat(info['CPI']  || 1),
      bcwp        : parseFloat(info['BCWP'] || 0),
      bcws        : parseFloat(info['BCWS'] || 0),
      bac         : parseFloat(info['BAC']  || 0),
      acwp        : parseFloat(info['ACWP'] || 0),
      commentaire : String(info['Commentaire'] || ''),
      photos      : [],
      courbe               : GS.parseCourbe(courbeRows),
      disciplines          : GS.parseDisciplines(discRows),
      jalons               : GS.parseJalons(jalonRows),
      terr_qte             : GS.parseKpi(terrQteRows),
      terr_jalons          : GS.parseJalonsControl(terrJalRows),
      pieux_kpi            : GS.parseKpi(pieuxKpiRows),
      pieux_jalons         : GS.parseJalonsControl(pieuxJalRows),
      fond_kpi             : GS.parseKpi(fondKpiRows),
      fond_jalons          : GS.parseJalonsControl(fondJalRows),
      vrd_kpi              : GS.parseKpi(vrdKpiRows),
      vrd_jalons           : GS.parseJalonsControl(vrdJalRows),
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
