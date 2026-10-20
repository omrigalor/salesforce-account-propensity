// Rebuild the named row objects the UI expects from the index-encoded arrays. The account
// fields come from the shared table; only the per-product numbers travel on the row itself.
for(const pk in ROWS){ROWS[pk]=ROWS[pk].map(a=>{const m=ACCTMETA[a[0]];return{
  c:m[0],d:m[1],i:m[2],sg:m[3],e:m[4],conf:m[5],ct:m[6],sf:m[7],nsf:m[8],
  acv:a[1],w:a[2],need:a[3],rd:a[4],rel:a[5],fr:a[6],mo:a[7],ev:a[8],eff:a[9]};});}
// rehydrate the index-encoded signal values into the named form the UI expects
for(const d in ACCT){const o={};for(const t of ACCT[d].v)o[SIGKEYS[t[0]]]=[t[1],t[2]];ACCT[d].v=o;}
const $=i=>document.getElementById(i);
let sortKey="ev",sortDir=-1,filters=new Set(),cur=null,ptab="score";
const OBS=["public_fp","wikidata","sec","jobs","web"];

$("sCo").textContent=(REP.companies||0).toLocaleString();
$("sPr").textContent=PRODUCTS.length;
$("sPa").textContent=(REP.scored_pairs||0).toLocaleString();
$("sOb").textContent=(REP.observed_signals||62)+"/"+(REP.signals||165);

const sel=$("prod");
FAMS.forEach(f=>{const g=document.createElement("optgroup");g.label=f;
  PRODUCTS.filter(p=>p.f===f).forEach(p=>{const o=document.createElement("option");
    o.value=p.k;o.textContent=p.n;g.appendChild(o);});sel.appendChild(g);});
const all=Object.values(ROWS).flat();
$("ind").innerHTML='<option value="">All industries</option>'+
  [...new Set(all.map(r=>r.i).filter(Boolean))].sort().map(i=>`<option>${i}</option>`).join("");
$("cty").innerHTML='<option value="">All countries</option>'+
  [...new Set(all.map(r=>r.ct).filter(Boolean))].sort().map(i=>`<option>${i}</option>`).join("");

const money=x=>{x=+x||0;return x>=1e9?"$"+(x/1e9).toFixed(2)+"B":x>=1e6?"$"+(x/1e6).toFixed(2)+"M":
  x>=1e3?"$"+Math.round(x/1e3)+"K":"$"+Math.round(x)};
const mtr=v=>`<span class="mtr"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>`;
const fmt=(v,u)=>{if(u==="bool")return(+v)?"Yes":"No";if(u==="usd")return money(v);
  if(u==="pct")return(+v*100).toFixed(0)+"%";if(u==="count")return(+v).toLocaleString();
  if(u==="months")return(+v).toFixed(0)+" mo";return(+v).toFixed(0);};

function ctx(){const p=PRODUCTS.find(x=>x.k===sel.value);
  const u={org:"per org / month",consumption:"consumption",gmv:"% of GMV",
    pct_spend:"% of current Salesforce spend"}[p.meter]||("per user / mo &middot; "+p.meter.split(":")[1]);
  $("ctx").innerHTML=`<span><b>${p.n}</b></span><span>Buyer: <b>${p.persona}</b></span>
    <span>Segments: <b>${p.fit.join(" &middot; ")}</b></span><span>Priced: <b>${u}</b></span>
    <span style="font-style:italic;color:var(--ink2)">&ldquo;${p.edge}&rdquo;</span>`;}

function rowsNow(){let r=(ROWS[sel.value]||[]).slice();
  const sg=$("seg").value,ind=$("ind").value,ct=$("cty").value,q=$("q").value.toLowerCase().trim();
  if(sg)r=r.filter(x=>x.sg===sg); if(ind)r=r.filter(x=>x.i===ind); if(ct)r=r.filter(x=>x.ct===ct);
  if(q)r=r.filter(x=>(x.c+" "+x.d).toLowerCase().includes(q));
  if(filters.has("sf"))r=r.filter(x=>x.sf===1); if(filters.has("new"))r=r.filter(x=>x.sf!==1);
  if(filters.has("big"))r=r.filter(x=>x.acv>250000);
  r.sort((a,b)=>{const A=a[sortKey],B=b[sortKey];
    return typeof A==="string"?A.localeCompare(B)*sortDir:(A-B)*sortDir;});return r;}

/* ---------- right panel ---------- */
function paneScore(r,p){
  return `<div class="kpis">
    <div class="kpi"><div class="k">Modeled propensity</div><div class="v">${r.w.toFixed(1)}%</div>
      <div class="n">ranking signal, not a forecast</div></div>
    <div class="kpi"><div class="k">Modeled ACV</div><div class="v">${money(r.acv)}</div>
      <div class="n">if they buy, per year</div></div>
    <div class="kpi"><div class="k">Modeled value</div><div class="v">${money(r.ev)}</div>
      <div class="n">ACV &times; win% &times; margin, time-discounted</div></div>
    <div class="kpi"><div class="k">Est. time to close</div><div class="v">${r.mo.toFixed(0)} mo</div>
      <div class="n">effort ${r.eff||"&mdash;"}</div></div></div>
  <div class="grp"><h4>The five layers</h4>
    ${[["Need","need",r.need,"fit against this product's drivers"],
       ["Readiness","rd",r.rd,"timing and trigger evidence"],
       ["Relationship","rel",r.rel,r.sf?("Salesforce detected &middot; "+r.nsf+" product(s)"):"no footprint detected"],
       ["Friction","fr",r.fr,"higher = harder to close"],
       ["Data confidence","cf",r.conf,"how much of this is observed vs assumed"]]
      .map(([l,k,v,n])=>`<div class="sig"><div><div class="l">${l}</div><div class="w">${n}</div></div>
        <div class="r"><span class="val">${mtr(v)}${(+v).toFixed(0)}</span></div></div>`).join("")}
  </div>
  <div class="grp"><h4>How the ACV was calculated</h4>
    <div style="font-size:12px;color:var(--ink2);padding:6px 0">${p.basis||''}
    ${p.est?'<span class="tag t-inf">estimated rate</span>':''}${p.note?("<br><span class='w'>"+p.note+"</span>"):""}</div></div>
  ${r.conf<70?`<div class="note"><b>Read this before trusting the ranking.</b> Data confidence is
    ${r.conf.toFixed(0)}/100 for this account, so the score has already been pulled toward the base
    rate. It is a hypothesis worth one call, not a claim.</div>`:''}
  ${p.risk?`<div class="warn"><b>Retention risk, not expansion.</b> ${p.edge}</div>`:''}`;
}

function paneSignals(r,p){
  const a=ACCT[r.d]||{v:{},ev:""};
  const drv=new Map(p.drivers);
  let out="";
  const known=Object.keys(a.v).length, tot=Object.keys(SIG).length;
  out+=`<div class="kpis"><div class="kpi"><div class="k">Signals populated</div>
      <div class="v">${known}<span style="font-size:12px;color:var(--ink3)"> / ${tot}</span></div>
      <div class="n">${(known/tot*100).toFixed(0)}% populated for this account</div></div>
    <div class="kpi"><div class="k">Drivers for this product</div>
      <div class="v">${p.ndrv}<span style="font-size:12px;color:var(--ink3)"> weighted signals</span></div>
      <div class="n"><b>${p.uniq}</b> unique to this product &middot; <b>${p.shared}</b> shared with others</div></div></div>`;
  if(a.ev&&a.ev!=="nan"&&a.ev.trim()) out+=`<div class="ok"><b>Observed evidence for this domain:</b><br>${a.ev}</div>`;
  CATS.forEach(cat=>{
    const keys=Object.keys(SIG).filter(k=>SIG[k].c===cat);
    const have=keys.filter(k=>a.v[k]!==undefined);
    if(!have.length&&!keys.some(k=>drv.has(k))) return;
    out+=`<div class="grp"><h4>${cat} <span style="color:var(--ink3);font-weight:400;
      text-transform:none;letter-spacing:0">&middot; ${have.length} of ${keys.length} known</span></h4>`;
    keys.forEach(k=>{
      const m=SIG[k], d=drv.get(k), val=a.v[k];
      const tag=OBS.includes(m.s)?'<span class="tag t-obs">observed</span>':
                m.s==="llm"?'<span class="tag t-inf">needs enrichment</span>':
                '<span class="tag t-drv">derived</span>';
      // Every known signal gets a bar on its own 0-100 range, so two signals measured in
      // different units (a headcount and a percentage) can be compared by eye.
      let pos=null;
      if(val!==undefined&&typeof val[0]==="number"&&m.lo!==null&&m.hi!==null&&m.hi>m.lo){
        // Headcount, revenue and web traffic span several orders of magnitude, so a linear
        // position puts almost every company within a hair of zero and the bar stops telling
        // you anything. Where the range spans more than 1000x, position on a log scale.
        const wide = m.lo>0 && m.hi/m.lo>1000;
        if(wide){
          const v=Math.max(val[0],m.lo);
          pos=(Math.log(v)-Math.log(m.lo))/(Math.log(m.hi)-Math.log(m.lo))*100;
        } else {
          pos=(val[0]-m.lo)/(m.hi-m.lo)*100;
        }
        pos=Math.max(0,Math.min(100,pos));
        if(m.dir<0) pos=100-pos;
      }
      out+=`<div class="sig"><div style="flex:1;min-width:0"><div class="l">${m.l}${tag}
        ${d!==undefined?`<span class="w" style="color:var(--brand)"> &middot; drives this product (weight ${(+d).toFixed(1)})</span>`:""}</div>
        <div class="w">${m.w||SRC[m.s]||""}</div>
        ${pos!==null?`<div class="sigbar">${mtr(pos)}<span class="sigpos">${pos.toFixed(0)}<span
           style="color:var(--ink3)">/100 on this signal&rsquo;s range</span></span></div>`:""}</div>
        <div class="r">${val!==undefined?`<span class="val">${fmt(val[0],m.u)}</span>
          <div class="w">conf ${(val[1]*100).toFixed(0)}%</div>`:'<span class="miss">not known</span>'}</div></div>`;
    });
    out+="</div>";
  });
  return out;
}

function paneApproach(r,p){
  return `<div class="grp"><h4>Who to reach</h4>
    <div class="sig"><div class="l">Economic buyer</div><div class="r val">${p.persona}</div></div>
    <div class="sig"><div class="l">Segment</div><div class="r val">${r.sg}</div></div>
    <div class="sig"><div class="l">Employees</div><div class="r val">${(+r.e).toLocaleString()}</div></div>
    <div class="sig"><div class="l">Country</div><div class="r val">${r.ct||"&mdash;"}</div></div></div>
  <div class="grp"><h4>Potential angle &mdash; validate first</h4>
    <div style="font-size:12.5px;padding:8px 0;color:var(--ink2)">&ldquo;${p.edge}&rdquo;</div></div>
  <div class="grp"><h4>Category alternatives &mdash; not confirmed incumbents</h4>
    <div style="font-size:12.5px;padding:8px 0;color:var(--ink2)">${p.comp.length?p.comp.join(", "):"&mdash;"}</div></div>
  <div class="grp"><h4>Top drivers for this product</h4>
    ${p.drivers.slice(0,10).map(([k,w])=>{const m=SIG[k]||{l:k,s:"derived"};
      return `<div class="sig"><div><div class="l">${m.l}</div><div class="w">${SRC[m.s]||m.s}</div></div>
      <div class="r val">${(+w).toFixed(1)}&times;</div></div>`;}).join("")}</div>`;
}

function openPane(r){
  cur=r; const p=PRODUCTS.find(x=>x.k===sel.value);
  $("pT").textContent=r.c;
  $("pS").innerHTML=`${r.d} &middot; ${r.i||"&mdash;"} &middot; ${p.n}`;
  drawPane();
  $("panel").classList.add("on"); $("scrim").classList.add("on");
}
function drawPane(){
  if(!cur)return; const p=PRODUCTS.find(x=>x.k===sel.value);
  $("pB").innerHTML = ptab==="score"?paneScore(cur,p):ptab==="signals"?paneSignals(cur,p):paneApproach(cur,p);
}
function closePane(){$("panel").classList.remove("on");$("scrim").classList.remove("on");
  document.querySelectorAll("tr.sel").forEach(e=>e.classList.remove("sel"));cur=null;}
$("pX").onclick=closePane; $("scrim").onclick=closePane;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePane();});
document.querySelectorAll(".ptab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".ptab").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); ptab=t.dataset.t; drawPane();});

function render(){
  ctx(); const r=rowsNow(),tb=$("tb"),p=PRODUCTS.find(x=>x.k===sel.value);
  $("ttl").textContent=p.n; $("cnt").textContent=r.length+" shown of "+p.eligible+" eligible accounts";
  tb.innerHTML="";
  r.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).forEach((x,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td class="rk">${pageIndex * PAGE_SIZE+i+1}</td>
      <td><span class="co">${x.c}</span><span class="dm">${x.d}</span></td>
      <td>${x.i||"&mdash;"}</td>
      <td><span class="bdg b-s">${x.sg}</span> ${x.sf?'<span class="bdg b-c">customer</span>':
        '<span class="bdg b-n">net-new</span>'}</td>
      <td class="num">${mtr(x.w*6)}${x.w.toFixed(1)}%</td>
      <td class="num">${money(x.acv)}</td>
      <td class="num">${x.mo.toFixed(0)} mo</td>
      <td class="num"><b>${money(x.ev)}</b></td>
      <td class="num"><button class="sigbtn">Signals</button></td>`;
    tr.onclick=()=>{document.querySelectorAll("tr.sel").forEach(e=>e.classList.remove("sel"));
      tr.classList.add("sel"); openPane(x);};
    tb.appendChild(tr);
  });
  if(cur)drawPane();
}
/* ---------- view tabs ---------- */
let dfilt=new Set();
function renderDict(){
  const q=($("dq").value||"").toLowerCase();
  const rows=Object.entries(SIG).filter(([k,m])=>{
    if(q&&!(m.l+" "+m.c+" "+(m.w||"")).toLowerCase().includes(q))return false;
    if(dfilt.size){
      const isObs=OBS.includes(m.s), isLlm=m.s==="llm", isDrv=["derived","prior"].includes(m.s);
      if(dfilt.has("obs")&&!isObs)return false;
      if(dfilt.has("llm")&&!isLlm)return false;
      if(dfilt.has("derived")&&!isDrv)return false;}
    return true;});
  const tot=Object.keys(ACCT).length||1;
  $("dictb").innerHTML=rows.map(([k,m])=>{
    const have=Object.values(ACCT).filter(a=>a.v[k]!==undefined).length;
    const pct=Math.round(have/tot*100);
    const tag=OBS.includes(m.s)?'<span class="tag t-obs">observed</span>':
      m.s==="llm"?'<span class="tag t-inf">enrichment</span>':'<span class="tag t-drv">derived</span>';
    return `<tr><td><b style="color:var(--navy)">${m.l}</b>${tag}
      <span class="dm">${k}</span></td><td>${m.c}</td><td>${SRC[m.s]||m.s}</td>
      <td>${m.layer||""}</td><td style="font-size:11.5px;color:var(--ink2)">${m.w||""}</td>
      <td class="num">${mtr(pct)}${pct}%</td></tr>`;}).join("");
  $("dcount")&&($("dcount").textContent=rows.length);
}
function renderVal(){
  $("modelLabels").innerHTML=(LABELSTAT||[]).map(x=>{
    const col=x.usable?"var(--green)":x.kind==="undetectable"?"var(--ink3)":"var(--amber)";
    const bg=x.usable?"var(--green-l)":x.kind==="undetectable"?"var(--bg2)":"var(--amber-l)";
    const kind=x.kind==="direct"?"direct Salesforce adoption":
               x.kind==="category"?"category (Salesforce or rival)":
               x.kind==="undetectable"?"none possible":"too few";
    const st=x.usable?"model fitted":x.kind==="undetectable"?"never detectable":
             `needs ${x.gap_to_model} more`;
    return `<tr><td><b style="color:var(--navy)">${(PRODUCTS.find(p=>p.k===x.product)||{n:x.product}).n}</b></td>
      <td style="font-size:11.5px;color:var(--ink2)">${kind}</td>
      <td class="num"><b>${x.n_pos}</b></td><td class="num">${x.clean_negatives||0}</td>
      <td><span class="bdg" style="background:${bg};color:${col}">${st}</span>
      <div class="w" style="margin-top:2px">${x.note||""}</div></td></tr>`;}).join("");
  const c=(VAL.critic||[]);
  $("critB").innerHTML=c.map(x=>{
    const col=x.status==="pass"?"var(--green)":x.status==="fail"?"var(--red)":"var(--amber)";
    const bg=x.status==="pass"?"var(--green-l)":x.status==="fail"?"var(--red-l)":"var(--amber-l)";
    return `<tr><td><span class="bdg" style="background:${bg};color:${col}">${x.status.toUpperCase()}</span></td>
      <td><b style="color:var(--navy)">${x.check}</b></td>
      <td style="font-size:11.5px;color:var(--ink2)">${x.detail}</td></tr>`;}).join("");
  const st=VAL.stability||{}, cf=VAL.conformal||{};
  $("valNote").innerHTML=`<div class="note" style="margin:10px 14px">
    <b>Read this before believing any number in the queue.</b>
    Cross-validated AUC on the observed labels currently runs <b>0.46&ndash;0.60</b>, where 0.5 is a coin
    flip. An earlier run showed 0.83&ndash;0.96 &mdash; that was <b>provenance leakage</b>: only the largest
    domains had been fingerprinted, so un-probed companies were being treated as negatives and the
    model was learning &ldquo;was this row probed&rdquo; instead of &ldquo;does this company use the product&rdquo;.
    Training now runs only on probed rows, and the honest number is near-random.
    <br><br><b>Why:</b> only ~27% of signals are populated per account, and the ones that actually
    predict buying &mdash; triggers, AI initiatives, renewal timing &mdash; are exactly the ones that need
    the enrichment pass. <b>This is the single thing that would move the model.</b>
    <br><br>Bootstrap: <b>${((st.top_retained_mean||0)*100).toFixed(0)}%</b> of the top 50 survives resampling
    (p10 ${((st.top_retained_p10||0)*100).toFixed(0)}%). Conformal interval:
    <b>&plusmn;${((cf.interval_halfwidth||0)*100).toFixed(0)} points</b> at 90% coverage.</div>`;
  $("valB").innerHTML=(VAL.learn_report||[]).filter(r=>r.status==="learned").map(r=>{
    const a=r.auc||0;
    const read=a>=0.7?"usable signal":a>=0.6?"weak but real":"no better than chance &mdash; needs enrichment";
    const col=a>=0.7?"var(--green)":a>=0.6?"var(--amber)":"var(--red)";
    return `<tr><td><b style="color:var(--navy)">${(PRODUCTS.find(p=>p.k===r.product)||{n:r.product}).n}</b></td>
      <td class="num">${r.labels}</td><td class="num"><b style="color:${col}">${a.toFixed(2)}</b></td>
      <td class="num">${r.gap_to_target}</td>
      <td style="font-size:11.5px;color:var(--ink2)">${read}</td></tr>`;}).join("");
}
function renderData(){
  $("uniB").innerHTML=`
   <tr><td><b style="color:var(--navy)">1. Universe</b></td><td>Wikidata company entities
     (P856 website, P1128 employees, P2139 revenue)</td><td>CC0 &mdash; free</td>
     <td class="num">${PROV.n_universe.toLocaleString()}</td>
     <td>Real companies with a <b>domain</b>, headcount, revenue, country. The domain is what makes
       step 2 possible.</td></tr>
   <tr><td><b style="color:var(--navy)">2. Adoption evidence</b></td>
     <td>Public DNS + one HTTP fetch per domain (CNAME, NS, MX, SPF, DKIM, response headers)</td>
     <td>free &mdash; no vendor, no licence</td><td class="num">${PROV.n_probed.toLocaleString()}</td>
     <td><b>${PROV.n_sf.toLocaleString()}</b> with Salesforce detected. This is the training label
       and the relationship signal &mdash; normally a $30&ndash;60K/yr data vendor.</td></tr>
   <tr><td><b style="color:var(--navy)">3. Derived</b></td><td>Computed from 1 and 2 (department
     headcounts from industry ratios, current Salesforce spend, contact volume)</td><td>free</td>
     <td class="num">25 signals</td><td>Seat and consumption math for every pricing unit.</td></tr>
   <tr><td><b style="color:var(--navy)">4. Enrichment</b></td><td>One LLM call per company filling
     the 78 signals that cannot be observed publicly</td><td><b>~$0.01/company</b> &mdash; your key, hard cap</td>
     <td class="num">78 signals</td><td>Triggers, AI initiatives, renewal timing, GMV, ad spend.
       <b>Without this the ranking barely separates</b> &mdash; every account sits near the base rate.</td></tr>`;
  $("labB").innerHTML=LABELS.map(l=>{
    const none=l.need_domains===0;
    const ok=l.have>=500;
    return `<tr><td><b style="color:var(--navy)">${l.n}</b><span class="dm">${l.f}</span></td>
      <td style="font-size:11.5px;color:var(--ink2)">${l.src}</td>
      <td class="num"><b style="color:${ok?'var(--green)':l.have?'var(--ink)':'var(--ink3)'}">${l.have}</b></td>
      <td class="num">${l.rate?l.rate.toFixed(1)+"%":"&mdash;"}</td>
      <td class="num">${ok?'<span class="bdg b-c">met</span>':l.gap}</td>
      <td style="font-size:11.5px;color:var(--ink2)">${
        ok?"&mdash;":none?"<b>No public footprint.</b> Needs job-posting labels, Salesforce customer stories (328 available, product-tagged), or real CRM data."
          :"Fingerprint ~"+l.need_domains.toLocaleString()+" domains at this hit rate"}</td></tr>`;}).join("");
}
function renderProd(){
  $("prodb").innerHTML=PRODUCTS.map(p=>{
    const u={org:"per org / mo",consumption:"consumption",gmv:"% of GMV",
      pct_spend:"% of SF spend"}[p.meter]||("per user / mo");
    return `<tr><td><b style="color:var(--navy)">${p.n}</b>
      <span class="dm">${p.edge}</span></td><td>${p.f}</td><td>${p.persona}</td>
      <td>${p.fit.join(", ")}</td><td>${u}${p.est?' <span class="tag t-inf">est.</span>':''}</td>
      <td class="num">${p.drivers.length}</td><td class="num">${p.eligible}</td></tr>`;}).join("");
}
document.querySelectorAll(".tab").forEach(tb=>tb.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));tb.classList.add("on");
  const v=tb.dataset.v;
  document.querySelector(".wrap").style.display=v==="queue"?"":"none";
  $("vDict").style.display=v==="dict"?"":"none";
  $("vProd").style.display=v==="prod"?"":"none";
  document.querySelector(".bar").style.display=v==="queue"?"":"none";
  $("ctx").style.display=v==="queue"?"":"none";
  $("vData").style.display=v==="data"?"":"none";
  $("vVal").style.display=v==="val"?"":"none";
  if(v==="dict")renderDict(); if(v==="prod")renderProd(); if(v==="data")renderData();
  if(v==="val")renderVal();
});
$("dq").oninput=renderDict;
document.querySelectorAll("[data-d]").forEach(c=>c.onclick=()=>{
  const f=c.dataset.d; dfilt.has(f)?dfilt.delete(f):dfilt.add(f); c.classList.toggle("on"); renderDict();});

sel.onchange=()=>{closePane();render();};
["seg","ind","cty"].forEach(i=>$(i).onchange=render); $("q").oninput=render;
document.querySelectorAll("[data-f]").forEach(c=>c.onclick=()=>{const f=c.dataset.f;
  if(f==="sf"&&filters.has("new")){filters.delete("new");document.querySelector('[data-f=new]').classList.remove("on");}
  if(f==="new"&&filters.has("sf")){filters.delete("sf");document.querySelector('[data-f=sf]').classList.remove("on");}
  filters.has(f)?filters.delete(f):filters.add(f);c.classList.toggle("on");render();});
document.querySelectorAll("th[data-s]").forEach(th=>th.onclick=()=>{
  const k=th.dataset.s;sortDir=(sortKey===k)?-sortDir:-1;sortKey=k;render();});
render();
