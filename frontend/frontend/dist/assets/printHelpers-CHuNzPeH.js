import{i as L}from"./vendor-i18n-FHetUBVu.js";import G from"./purify.es-BPuvlvQ_.js";import{G as B,ax as P,F as ot,ay as q,av as it}from"./index-DKHa65Ps.js";function pt(e,r){const i=new DOMParser().parseFromString(r,"text/html");e.document.head.innerHTML=i.head.innerHTML,e.document.body.innerHTML=i.body.innerHTML,e.document.title=i.title,e.document.querySelectorAll("script").forEach(o=>{const s=e.document.createElement("script");o.src?s.src=o.src:s.textContent=o.textContent,o.parentNode?.replaceChild(s,o)})}function c(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;")}function b(e,r){const i=Math.round(parseFloat(String(e)));return ot(i,0,r??q())}function lt(e,r){return e?it(e,q()):""}function dt(e){const r=P(),i=L.getFixedT(r),o={especes:"common:payment_modes.cash",cheque:"common:payment_modes.check",carte:"common:payment_modes.card",virement:"common:payment_modes.transfer",om:"common:payment_modes.orange_money",momo:"common:payment_modes.mobile_money",coupon:"common:payment_modes.coupon",en_compte:"common:payment_modes.recouvrement"}[e];return o&&L.exists(o,{lng:r})?i(o):(r==="en"?{especes:"Cash",cheque:"Check",carte:"Card",virement:"Transfer",om:"Orange Money",momo:"Mobile Money",coupon:"Money Coupon",en_compte:"On Account"}:{especes:"Espèces",cheque:"Chèque",carte:"Carte",virement:"Virement",om:"Orange Money",momo:"Mobile Money",coupon:"Coupon de Monnaie",en_compte:"En Compte"})[e]||e?.toUpperCase()||"N/A"}function mt(e,r,i,a){const o=document.createElement("iframe");o.style.position="fixed",o.style.width="0",o.style.height="0",o.style.border="0",o.style.visibility="hidden",o.setAttribute("aria-hidden","true"),document.body.appendChild(o);try{const s=nt(e,r,i),t=o.contentDocument||o.contentWindow?.document;if(!t)throw new Error("Impossible d'accéder au document de l'iframe");t.open(),t.write(s),t.close();const p=()=>{const d=o.contentWindow;d&&(d.focus(),d.print())};if(t.readyState==="complete")setTimeout(p,500);else{const d=()=>{setTimeout(p,500),t.removeEventListener("readystatechange",d)};t.addEventListener("readystatechange",d)}setTimeout(()=>{o.parentNode?.removeChild(o)},3e4)}catch(s){B.error("Erreur impression iframe:",s),o.parentNode?.removeChild(o),a?.()}}function ut(e,r){const i=document.createElement("iframe");i.style.position="fixed",i.style.width="0",i.style.height="0",i.style.border="0",i.style.visibility="hidden",i.setAttribute("aria-hidden","true"),document.body.appendChild(i);try{const a=i.contentDocument||i.contentWindow?.document;if(!a)throw new Error("Impossible d'accéder au document de l'iframe");a.open(),a.write(e),a.close(),setTimeout(()=>{i.parentNode?.removeChild(i)},3e4)}catch(a){B.error("Erreur impression iframe:",a),i.parentNode?.removeChild(i),r?.()}}function nt(e,r,i){const a=G.sanitize(r,{RETURN_TRUSTED_TYPE:!1}),o=G.sanitize(i,{ALLOWED_TAGS:["style","link"],ALLOWED_ATTR:["rel","href","type","media"],FORCE_BODY:!0,RETURN_TRUSTED_TYPE:!1}),s=P(),t=L.getFixedT(s,"printing");return`<!DOCTYPE html>
<html lang="${s}">
<head>
  <title>${c(t("document.ticket_title"))}</title>
  <base href="${window.location.origin}/">
  <!-- Polices système uniquement : évite tout appel réseau (Google Fonts) pour fonctionner offline. -->
  ${o}
  <style>
    * {
      box-sizing: border-box; margin: 0; padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    svg * { shape-rendering: crispEdges; }
    @media print {
      @page { 
        size: ${e}mm auto; 
        margin: 0; 
      }
      html, body { 
        width: ${e}mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important;
        color: black !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    html, body {
      width: ${e}mm;
      max-width: ${e}mm;
      margin: 0 auto;
      padding: 0;
      background: white !important;
      color: black !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      overflow: hidden;
    }
    #print-root {
      width: ${e}mm;
      max-width: ${e}mm;
      overflow: hidden;
    }
    #ticket-preview {
      width: ${e}mm !important;
      max-width: ${e}mm !important;
      min-width: 0 !important;
      margin: 0 !important;
      /* Marges élargies : les imprimantes thermiques ont ~3-4mm de bord
         non imprimable de chaque côté — sans cela, la colonne des montants
         (alignée à droite) est rognée. */
      padding: 2mm 4mm 4mm 3mm !important;
      background: white !important;
      color: black !important;
      box-shadow: none !important;
      outline: none !important;
      overflow: hidden;
      word-break: break-word;
      overflow-wrap: break-word;
      /* Police monospace : reproduit le rendu de la police bitmap ESC/POS
         des imprimantes thermiques (caractères à chasse fixe, ticket "machine"). */
      font-family: 'Courier New', 'Lucida Console', ui-monospace, monospace !important;
      font-size: 13px;
      line-height: 1.55;
      letter-spacing: 0.2px;
    }
    #ticket-preview * {
      font-family: inherit !important;
    }
    /* Rythme "aéré" : reproduit l'espacement du ticket ESC/POS (sauts de ligne
       entre sections, air entre les produits, blanc avant la coupe). */
    #ticket-preview * {
      color: black !important;
    }
    #ticket-preview .mb-1 { margin-bottom: 5px !important; }
    #ticket-preview .mb-2 { margin-bottom: 10px !important; }
    #ticket-preview .mb-3 { margin-bottom: 12px !important; }
    #ticket-preview .my-2 { margin-top: 10px !important; margin-bottom: 10px !important; }
    #ticket-preview .mt-1 { margin-top: 5px !important; }
    #ticket-preview .mt-2 { margin-top: 10px !important; }
    #ticket-preview .mt-3 { margin-top: 12px !important; }
    #ticket-preview .mt-4 { margin-top: 14px !important; }
    #ticket-preview .mt-5 { margin-top: 16px !important; }
    #ticket-preview .pt-1 { padding-top: 5px !important; }
    #ticket-preview .pt-2 { padding-top: 10px !important; }
    #ticket-preview .pt-3 { padding-top: 12px !important; }
    #ticket-preview .pb-2 { padding-bottom: 10px !important; }
    #ticket-preview td.py-1 { padding-top: 6px !important; padding-bottom: 6px !important; }
    #ticket-preview .leading-tight { line-height: 1.5 !important; }
    /* Total net à payer : mis en avant comme le double-size ESC/POS.
       On cible la ligne border-y (pas la ligne "en lettres" qui est border-b). */
    #ticket-preview [class~="py-1.5"][class~="border-y"] {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      font-size: 16px !important;
    }
    /* Blanc avant la "coupe" : équivalent du feed(3) ESC/POS. */
    #ticket-preview::after { content: ''; display: block; height: 7mm; }
    /* Impression thermique 203 dpi : les traits fins (font-weight < 600)
       ressortent gris/effacés. On force du semibold partout pour obtenir
       des traits épais et un noir net, comme les tickets des autres caisses. */
    #ticket-preview :where(p, span, td, th, div, h1, h2, h3, h4, h5, a, li, strong, b, em) {
      font-weight: 600 !important;
    }
    #ticket-preview table { table-layout: fixed; width: 100% !important; }
    #ticket-preview td, #ticket-preview th { overflow: hidden; text-overflow: ellipsis; }
    /* Rehausse les tailles de police trop petites pour l'impression thermique
       (text-micro=9px, text-caption=10px, [8px] pour les prix unitaires). */
    #ticket-preview .text-micro { font-size: 12px !important; }
    #ticket-preview .text-caption { font-size: 13px !important; }
    #ticket-preview .text-xs { font-size: 12.5px !important; }
    #ticket-preview .text-sm { font-size: 15px !important; }
    #ticket-preview .text-base { font-size: 16px !important; }
    #ticket-preview [class*="text-[8px]"] { font-size: 11px !important; }
  </style>
</head>
<body>
  <div id="print-root">
    ${a}
  </div>
  <script>
    window.onload = () => {
        const doPrint = () => {
            window.print();
            window.close();
        };
        if (document.fonts) {
            document.fonts.ready.then(() => {
                setTimeout(doPrint, 500);
            });
        } else {
            setTimeout(doPrint, 1500);
        }
    };
  <\/script>
</body>
</html>`}function rt(e){let r=0,i=0,a=0,o=0,s=0,t=0;for(const p of e){const d=p.quantity||0,y=p.unites_gratuites||0,$=d+y,k=parseFloat(String(p.price_cost||p.price||0)),_=parseFloat(String(p.tva||0)),S=parseFloat(String(p.selling_price||0)),m=k*$,g=m*(_/100);r+=m,i+=g,a+=1,o+=$,s+=y;const f=S/(1+_/100);t+=(f-k)*d}return{totalHT:r,totalTVA:i,totalLignes:a,totalUnites:o,totalGratuites:s,totalMarge:t}}function ft(e,r,i="inkless",a="none"){const o=P(),s=q(),t=L.getFixedT(o,"printing"),p=e.produits||[],{totalHT:d,totalTVA:y,totalLignes:$,totalUnites:k,totalGratuites:_,totalMarge:S}=rt(p),m=i==="inkless",g=m?"#334155":"#0f172a",f=m?"#94a3b8":"#64748b",Y=m?"1px dashed #94a3b8":"2px solid #0f172a",H=m?"transparent":"#f1f5f9",N=m?"1px dashed #cbd5e1":"2px solid #0f172a",M=m?"1px dotted #cbd5e1":"1px solid #e2e8f0",V=m?"1px dashed #94a3b8":"2px solid #0f172a",O=m?"1px dashed #94a3b8":"1px solid #0f172a",K=d+y,Q=c(r.name||""),R=c(r.address||""),j=c(r.tel),T=c(r.niu),C=c(r.rc),J=c(e.fournisseur_nom||"N/A"),X=c(e.numero_facture||`CMD-${e.id}`),Z=new Date().toLocaleDateString(s,{day:"2-digit",month:"2-digit",year:"numeric"})+" "+new Date().toLocaleTimeString(s,{hour:"2-digit",minute:"2-digit"}),W=c(e.closed_by_name||t("reception.system_admin")),w=n=>n.produit_nom||(typeof n.produit=="object"?n.produit.name:"")||"",U=n=>{const h=c(w(n)||t("reception.product_fallback",{id:n.produit})),x=c(n.lot||""),z=n.date_expiration?new Date(n.date_expiration).toLocaleDateString(s,{month:"2-digit",year:"numeric"}).replace("/","/"):"",u=c(n.produit_cip||(typeof n.produit=="object"?n.produit.cip1:"")||""),l=n.quantity||0,v=n.unites_gratuites||0,D=n.produit_stock_apres_reception??n.produit_stock??0,E=n.produit_stock_avant_reception??D-(l+v),tt=E+l+v,A=x?`${t("reception.lot")}: ${x}${z?` | ${t("reception.exp")}: ${z}`:""}`:"",I=parseFloat(String(n.price_cost||n.price||0)),et=I*(l+v);return`
      <tr>
        <td>
          <div class="product-name" title="${h}">${h}</div>
          ${A?`<div class="product-lot" title="${A}">${A}</div>`:""}
        </td>
        <td class="text-center">${u}</td>
        <td class="text-center">${E}</td>
        <td class="text-center">${l}</td>
        <td class="text-center">${v}</td>
        <td class="text-center">${tt}</td>
        <td class="text-right">${b(I)}</td>
        <td class="text-right">${b(et)}</td>
      </tr>
    `};let F="";if(a==="rayon"||a==="forme"){const n=new Map;for(const u of p){const l=(a==="rayon"?u.produit_rayon:u.produit_forme)||null;n.has(l)||n.set(l,[]),n.get(l).push(u)}const h=[...n.keys()].sort((u,l)=>u===null?1:l===null?-1:u.localeCompare(l,s)),x=t(a==="rayon"?"reception.group_rayon":"reception.group_forme"),z=t(a==="rayon"?"reception.no_rayon":"reception.no_forme");F=h.map(u=>{const l=(n.get(u)??[]).slice().sort((D,E)=>w(D).localeCompare(w(E),s));return`<tr class="group-row"><td colspan="8">${c(x)} : ${c(u||z)}</td></tr>`+l.map(U).join("")}).join("")}else F=(a==="alpha"?p.slice().sort((h,x)=>w(h).localeCompare(w(x),s)):p).map(U).join("");return`<!DOCTYPE html>
<html lang="${o}">
<head>
  <title>${c(t("reception.doc_title_numbered",{id:e.id}))}</title>
  <base href="${window.location.origin}/">
  <style>
    @page { size: A4; margin: 12mm 10mm 15mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: ${g}; background: #fff; line-height: 1.4; }
    .page { width: 100%; max-width: 180mm; margin: 0 auto; }
    
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: ${Y}; padding-bottom: 8px; margin-bottom: 8px; }
    .company-info .name { font-size: 16pt; font-weight: 700; color: ${g}; text-transform: uppercase; }
    .company-info .meta { font-size: 9pt; color: ${f}; margin-top: 4px; }
    .doc-type { border: ${V}; padding: 8px 20px; font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    .doc-ref { text-align: right; font-size: 9pt; color: ${f}; margin-top: 6px; }
    
    .info-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; }
    .info-box { flex: 1; }
    .info-box h3 { font-size: 8pt; text-transform: uppercase; color: ${f}; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-box .value { font-size: 11pt; font-weight: 600; color: ${g}; }
    .info-box .sub { font-size: 9pt; color: ${f}; margin-top: 2px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; table-layout: fixed; line-height: 1.2; }
    th { background: ${H}; color: ${g}; font-weight: 600; text-transform: uppercase; font-size: 8pt; padding: 5px 6px; border-top: ${N}; border-bottom: ${N}; text-align: left; white-space: nowrap; }
    td { padding: 4px 6px; border-bottom: ${M}; vertical-align: middle; white-space: nowrap; }
    .product-name { font-weight: 500; color: ${g}; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-lot { margin-top: 0; font-size: 7pt; line-height: 1.15; color: ${f}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    tr.group-row td { padding: 4px 6px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${g}; background: ${H}; border-bottom: ${M}; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .summary { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
    .summary-left { font-size: 9pt; color: ${f}; }
    .summary-left span { display: inline-block; margin-right: 16px; }
    .totals-box { padding: 8px 16px; display: flex; align-items: center; gap: 18px; }
    .totals-box .cell { display: flex; flex-direction: column; align-items: flex-end; }
    .totals-box .cell .lbl { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: ${f}; }
    .totals-box .cell .val { font-size: 10pt; font-weight: 700; color: ${g}; }
    .totals-box .cell.total { padding-left: 18px; border-left: ${O}; }
    .totals-box .cell.total .val { font-size: 13pt; }
    .totals-box .cell.margin { padding-left: 18px; border-left: ${O}; }
    .totals-box .cell.margin .val { color: ${m?"#16a34a":"#15803d"}; }
    
    .footer-note { margin-top: 20px; font-size: 8pt; color: ${f}; font-style: italic; border-top: ${M}; padding-top: 8px; }
    .print-footer { margin-top: 30px; text-align: center; font-size: 7pt; color: ${f}; }
    
    @media print {
      html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-info">
        <div class="name">${Q}</div>
        <div class="meta">${R}${R?"<br/>":""}${t("reception.tel")}: ${j}${T||C?"<br/>":""}${T?`NIU: ${T}`:""}${T&&C?" | ":""}${C?`RC: ${C}`:""}</div>
      </div>
      <div style="text-align: right;">
        <div class="doc-type">${t("reception.doc_title")}</div>
        <div class="doc-ref">${t("reception.ref")}: ${X}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>${t("reception.supplier")}</h3>
        <div class="value">${J}</div>
      </div>
      <div class="info-box" style="text-align: right;">
        <h3>${t("reception.details")}</h3>
        <div class="sub"><b>${t("reception.printed_on")}:</b> ${Z}</div>
        <div class="sub"><b>${t("reception.closed_by")}:</b> ${W}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width: 41%">
        <col style="width: 11%">
        <col style="width: 6.5%">
        <col style="width: 6%">
        <col style="width: 6%">
        <col style="width: 7%">
        <col style="width: 10%">
        <col style="width: 12.5%">
      </colgroup>
      <thead>
        <tr>
          <th>${t("reception.col_product")}</th>
          <th class="text-center">${t("reception.col_cip")}</th>
          <th class="text-center">${t("reception.col_stock_before")}</th>
          <th class="text-center">${t("reception.col_qty")}</th>
          <th class="text-center">${t("reception.col_free")}</th>
          <th class="text-center">${t("reception.col_stock")}</th>
          <th class="text-right">${t("reception.col_pa_ht")}</th>
          <th class="text-right">${t("reception.col_total_ht")}</th>
        </tr>
      </thead>
      <tbody>
        ${F}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-left">
        <span><b>${t("reception.lines")}:</b> ${$}</span>
        <span><b>${t("reception.units")}:</b> ${k}</span>
        <span><b>${t("reception.free_units")}:</b> ${_}</span>
      </div>
      <div class="totals-box">
        <div class="cell"><span class="lbl">${t("reception.total_ht")}</span><span class="val">${b(d)} F</span></div>
        <div class="cell"><span class="lbl">${t("reception.tva")}</span><span class="val">${b(y)} F</span></div>
        <div class="cell total"><span class="lbl">${t("reception.total_ttc")}</span><span class="val">${b(K)} F</span></div>
        <div class="cell margin"><span class="lbl">${t("reception.margin")}</span><span class="val">${b(S)} F</span></div>
      </div>
    </div>

    <div class="footer-note">${t("reception.footer_note")}</div>
    <div class="print-footer">${t("reception.print_footer")}</div>
  </div>
  <script>
    window.onload = () => {
      if (document.fonts) {
        document.fonts.ready.then(() => setTimeout(() => { window.print(); }, 500));
      } else {
        setTimeout(() => { window.print(); }, 1000);
      }
    };
  <\/script>
</body>
</html>`}export{ft as a,nt as b,lt as c,mt as d,c as e,b as f,dt as g,ut as p,pt as w};
