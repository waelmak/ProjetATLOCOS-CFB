const GS={
  async fetchTable(sheet){
    const url=`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;
    const txt=await(await fetch(url)).text();
    const json=JSON.parse(txt.replace(/^[^{]*/,'').replace(/\s*[;)]*$/,''));
    return json.table||{cols:[],rows:[]};
  },
  c(row,i){const c=(row.c||[])[i];return(!c||c.v===undefined||c.v===null)?null:c.v;},
  s(row,i){const v=this.c(row,i);return v!==null?String(v).trim():'';},
  n(row,i){const v=this.c(row,i);const n=parseFloat(v);return isNaN(n)?null:n;},

  async courbe(sheet){
    try{
      const t=await this.fetchTable(sheet);
      const out=(t.rows||[]).filter(r=>/^s\s*\d+$/i.test(this.s(r,0))).map(r=>({
        sem:this.s(r,0).toUpperCase().replace(/\s/g,''),
        plan:this.n(r,1)??0,
        reel:this.n(r,2)
      }));
      console.log(`[GS:${sheet}]`,out.length,'rows. ex:',JSON.stringify(out[0]));
      return out;
    }catch(e){console.warn(`[GS:${sheet}]`,e.message);return[];}
  },

  async info(){
    try{
      const t=await this.fetchTable(CONFIG.SHEETS.info);
      const obj={};
      const K=['Projet','Semaine','Date','Avancement_reel','Avancement_prevu','SPI','CPI','BAC','BCWP','BCWS','ACWP','Commentaire'];
      for(const r of(t.rows||[])){const k=this.s(r,0);const v=this.c(r,1);if(K.includes(k)&&v!==null)obj[k]=v;}
      console.log('[GS:INFO]',JSON.stringify(obj));
      return obj;
    }catch(e){console.warn('[GS:INFO]',e.message);return{};}
  },

  async disc(){
    try{
      const t=await this.fetchTable(CONFIG.SHEETS.disciplines);
      return(t.rows||[]).map(r=>({nom:this.s(r,0),plan:this.n(r,1)??0,reel:this.n(r,2)??0,poids:this.n(r,3)??0}))
        .filter(r=>r.nom.length>2&&!/^(discipline|total)/i.test(r.nom));
    }catch(e){return[];}
  },

  async jalons(){
    try{
      const t=await this.fetchTable(CONFIG.SHEETS.jalons);
      return(t.rows||[]).filter(r=>typeof this.c(r,0)==='number'&&this.s(r,1).length>2)
        .map(r=>({nom:this.s(r,1),poids:this.n(r,2)??0,montant:this.n(r,3)??0,statut:this.s(r,4)||'future',debut_p:'',fin_p:'',debut_r:'',fin_r:'',tf:0}));
    }catch(e){return[];}
  },

  async jalCtrl(sheet){
    try{
      const t=await this.fetchTable(sheet);
      return(t.rows||[]).filter(r=>this.s(r,0).length>3&&!/^(jalon|total|#)/i.test(this.s(r,0)))
        .map(r=>({nom:this.s(r,0),debut_p:this.s(r,1),fin_p:this.s(r,2),debut_r:this.s(r,3),fin_r:this.s(r,4),tf:this.n(r,5)??0,statut:this.s(r,6)||'future',poids:0,montant:0}));
    }catch(e){return[];}
  },

  async kpi(sheet){
    try{
      const t=await this.fetchTable(sheet);
      return(t.rows||[]).filter(r=>this.s(r,0).length>2&&(this.n(r,2)??0)>0&&!/^(indicateur|désignation|total)/i.test(this.s(r,0)))
        .map(r=>({nom:this.s(r,0),exec_:this.n(r,1)??0,total:this.n(r,2)??1,obs:this.s(r,3)}));
    }catch(e){return[];}
  },

  // Compatibilité debug.html
  async fetchRows(sheet){
    const t = await this.fetchTable(sheet);
    return (t.rows||[]).map(r=>(r.c||[]).map(c=>(!c||c.v===undefined||c.v===null)?null:c.v));
  },
  parseCourbe(rows){
    return rows.filter(r=>/^s\s*\d+$/i.test(String(r[0]||''))).map(r=>({
      sem:String(r[0]).toUpperCase().replace(/\s/g,''),
      plan:parseFloat(r[1])||0,
      reel:r[2]!==null?parseFloat(r[2]):null
    }));
  },

  async loadAll(){
    const S=CONFIG.SHEETS;
    const[info,courbe,disc,jalons,tQ,tJ,pK,pJ,fK,fJ,vK,vJ,cT,cP,cF,cV,cC]=
    await Promise.all([
      GS.info(),GS.courbe(S.courbe),GS.disc(),GS.jalons(),
      GS.kpi(S.terrQte),GS.jalCtrl(S.terrJal),
      GS.kpi(S.pieuxKpi),GS.jalCtrl(S.pieuxJal),
      GS.kpi(S.fondKpi),GS.jalCtrl(S.fondJal),
      GS.kpi(S.vrdKpi),GS.jalCtrl(S.vrdJal),
      GS.courbe(S.courbeTerr),GS.courbe(S.courbePieux),
      GS.courbe(S.courbeFond),GS.courbe(S.courbeVrd),GS.courbe(S.courbeCharp)
    ]);
    return{
      projet:String(info.Projet||'CFB Kamsar'),
      semaine:String(info.Semaine||'—'),
      date:String(info.Date||''),
      reel_pct:parseFloat(info.Avancement_reel||0),
      plan_pct:parseFloat(info.Avancement_prevu||0),
      spi:parseFloat(info.SPI||1),cpi:parseFloat(info.CPI||1),
      bcwp:parseFloat(info.BCWP||0),bcws:parseFloat(info.BCWS||0),
      bac:parseFloat(info.BAC||0),acwp:parseFloat(info.ACWP||0),
      commentaire:String(info.Commentaire||''),photos:[],
      courbe,disciplines:disc,jalons,
      terr_qte:tQ,terr_jalons:tJ,pieux_kpi:pK,pieux_jalons:pJ,
      fond_kpi:fK,fond_jalons:fJ,vrd_kpi:vK,vrd_jalons:vJ,
      courbe_terrassement:cT,courbe_pieux:cP,courbe_fondation:cF,
      courbe_vrd:cV,courbe_charpente:cC,
      updatedAt:new Date().toISOString()
    };
  }
};
