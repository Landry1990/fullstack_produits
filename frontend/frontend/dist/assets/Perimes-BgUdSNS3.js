import{j as e}from"./vendor-query-Dscd91Be.js";import{u as pe,a}from"./vendor-i18n-DbEs1fka.js";import{r as we,s as Se,n as T,k as O,ad as $e,ae as Ce,af as X,B as k,j as R,C as w,l as C,p as u,F as le,G as ne,m as V,w as z,o as oe}from"./feature-dashboard-50YdPrI0.js";import{n as N,e as J,m as ze,aR as De,d as Te,l as Ee,aS as qe,Y as ce,X as Me,ae as Ie,s as Le,O as Ae,a8 as Pe,I as He}from"./vendor-ui-rEllUvbT.js";import{l as S,w as Oe,u as Re,T as K,g as Q,h as D,i as n,j as Z,k as o,C as ee,I as de,S as Ve}from"./feature-caisse-uhmxPevV.js";import{D as Fe,e as Be,f as Ue,g as We,h as Ye,i as Ge}from"./feature-ventes-DZ05Azov.js";import"./vendor-router-BUNIphaQ.js";import"./vendor-dates-BrGixsn1.js";import"./vendor-http-DhXgJQ-f.js";import"./feature-commandes-6_fIHSxQ.js";import"./feature-inventory-DRzgas02.js";import"./feature-inventory-editor-pIsaRq9M.js";import"./feature-history-CVeQPDPm.js";import"./feature-inventory-states-B_8Co8T4.js";import"./vendor-xlsx-C2K9OxTh.js";import"./feature-reports-BKkQXZds.js";import"./vendor-pdf-CAk7lgUz.js";import"./feature-produits-DLeU8z5a.js";import"./feature-settings-Cg54ORFw.js";function Xe(){const{settings:t}=we(),{t:c}=pe("common"),g=a.useRef(null),i=a.useCallback(()=>`
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        padding: 0;
        margin: 0;
        color: black;
        background: white;
      }
      @media print {
        body { padding: 0; margin: 0; }
        .no-print { display: none !important; }
      }
      .print-container {
        width: ${t.ticket_paper_width||80}mm;
        max-width: ${t.ticket_paper_width||80}mm;
        margin: 0 auto;
        padding: 5px;
      }
      .print-header {
        text-align: center;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px dashed black;
      }
      .print-header h2 {
        margin: 0 0 5px 0;
        font-size: 1.1em;
        font-weight: bold;
        text-transform: uppercase;
      }
      .print-header p {
        margin: 1px 0;
        font-size: 0.8em;
      }
      .print-footer {
        text-align: center;
        margin-top: 15px;
        padding-top: 5px;
        border-top: 1px dashed black;
        font-size: 0.7em;
      }
      .print-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.85em;
        margin: 2px 0;
      }
      .print-divider {
        border-top: 1px dashed black;
        margin: 5px 0;
      }
      .print-total {
        font-weight: bold;
        font-size: 1.0em;
        border-top: 1px solid black;
        padding-top: 5px;
        margin-top: 5px;
      }
    `,[]),_=a.useCallback(()=>t?`
      <div class="print-header">
        <h2>${S(t.pharmacy_name||"PHARMACIE")}</h2>
        ${t.address?`<p>${S(t.address)}</p>`:""}
        ${t.phone?`<p>Tél: ${S(t.phone)}</p>`:""}
        ${t.email?`<p>${S(t.email)}</p>`:""}
        ${t.niu?`<p>NIU: ${S(t.niu)}</p>`:""}
        ${t.registre_commerce?`<p>RC: ${S(t.registre_commerce)}</p>`:""}
      </div>
    `:"",[t]),f=a.useCallback(d=>{const m=d||t?.ticket_footer_message||"Merci de votre visite !";return`
      <div class="print-footer">
        <p>${S(m)}</p>
        <p style="margin-top: 5px; font-size: 0.7em;">
          ${c("print.printed_on",{defaultValue:"Imprimé le"})} ${Se(new Date)}
        </p>
      </div>
    `},[t]),h=a.useCallback((d,m={})=>{const{title:b="Impression",width:q=400,height:p=600,autoClose:j=!0,autoPrint:x=!0,printDelay:M=500}=m,y=window.open("about:blank","",`height=${p},width=${q}`);return y?(Oe(y,d),y.document.title=b,x&&setTimeout(()=>{y.print(),j&&y.close()},M),y):(T.error("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les paramètres du navigateur."),null)},[]),E=a.useCallback((d,m)=>{h(d,m)},[h]),F=a.useCallback((d,m={})=>{const{showHeader:b=!0,showFooter:q=!0,footerMessage:p,customStyles:j="",...x}=m,M=`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${x.title||"Impression"}</title>
          <style>
            ${i()}
            ${j}
          </style>
        </head>
        <body>
          <div class="print-container">
            ${b?_():""}
            ${d}
            ${q?f(p):""}
          </div>
        </body>
      </html>
    `;h(M,x)},[i,_,f,h]),B=a.useCallback(d=>{window.open(d,"_blank")||N.error(c("popup_blocked"))},[c]),U=a.useCallback((d,m)=>{const b=`
      <!DOCTYPE html>
      <html>
        <head>
          <style>${i()}</style>
        </head>
        <body>
          ${d.outerHTML}
        </body>
      </html>
    `;h(b,m)},[i,h]);return{printHTML:E,printWithTemplate:F,openPrintPage:B,printRef:g,printElement:U}}const me=t=>{const c=t.getFullYear(),g=String(t.getMonth()+1).padStart(2,"0"),i=String(t.getDate()).padStart(2,"0");return`${c}-${g}-${i}`},Je=t=>{const[c]=t.split("T"),[g,i]=c.split("-"),_=Number(g),f=Number(i);if(!_||!f)return null;const h=new Date(_,f,0).getDate();return`${g}-${i}-${String(h).padStart(2,"0")}`},Ke=t=>t>5e5?"border-red-400 bg-red-50":t>1e5?"border-amber-400 bg-amber-50":"border-emerald-400 bg-emerald-50",xe=t=>{if(!t)return!1;const c=Je(t);if(!c)return!1;const g=me(new Date);return c<g};function bt(){const{t}=pe(["stock","common"]),[c,g]=a.useState([]),[i,_]=a.useState(null),[f,h]=a.useState(!1),[E,F]=a.useState(!1),[B,U]=a.useState(null),[d,m]=a.useState(30),[b,q]=a.useState(!0),[p,j]=a.useState(new Set),[x,M]=a.useState([]),[y,te]=a.useState(!1),[$,se]=a.useState("dashboard"),[I,he]=a.useState(()=>{const s=new Date;return s.setMonth(s.getMonth()-1),s.toISOString().split("T")[0]}),[L,ue]=a.useState(()=>new Date().toISOString().split("T")[0]),{sudoState:A,requireSudo:ae,closeSudo:ge}=Re(),[be,W]=a.useState(!1);a.useEffect(()=>{Y(),P(),re()},[]),a.useEffect(()=>{$==="list"?P():$==="history"&&re()},[d,b,$,I,L]);const Y=async()=>{F(!0);try{const s=await O.get("stock-lots/stats_perimes/");_(s.data)}catch(s){T.error("Erreur chargement stats:",s),N.error(t("perimes.messages.error_stats"))}finally{F(!1)}},re=async()=>{te(!0);try{const l=(await O.get("stock-adjustments/",{params:{reason_type:"PERIME",created_at__date__gte:I,created_at__date__lte:L,limit:100}})).data;M(Array.isArray(l)?l:l.results||[])}catch(s){T.error("Erreur chargement historiques:",s),N.error(t("perimes.messages.error_history"))}finally{te(!1)}},P=async()=>{h(!0),U(null),j(new Set);try{const s=new Date,l=new Date;l.setDate(s.getDate()+d);const r=me(l),H=(await O.get("stock-lots/",{params:{date_expiration_lte:r,include_empty:"false"}})).data;let v=Array.isArray(H)?H:H.results||[];b&&(v=v.filter(ie=>!!ie.date_expiration&&xe(ie.date_expiration))),g(v)}catch(s){T.error("Erreur chargement lots:",s),U(t("perimes.messages.error_loading"))}finally{h(!1)}},fe=async s=>{const l=prompt(t("perimes.prompt.qty",{lot:s.lot,max:s.quantity_remaining}),String(s.quantity_remaining));if(!l)return;const r=parseInt(l,10);if(isNaN(r)||r<=0||r>s.quantity_remaining){N.error(t("perimes.messages.invalid_qty"));return}ae(async(G,H)=>{try{W(!0),await O.post(`stock-lots/${s.id}/sortir_perimes/`,{quantity:r,reason:t("stock:ajustements.filters.reasons.PERIME")+" / "+t("stock:ajustements.filters.reasons.AVARIE"),validated_by_id:G,sudo_password:H}),N.success(t("perimes.messages.success_exit")),P(),Y()}catch(v){throw T.error("Erreur sortie stock:",v),N.error(t("perimes.messages.error_exit")+": "+oe(v,t("common:messages.error_generic"))),v}finally{W(!1)}},{title:t("perimes.confirm.exit_title"),message:t("perimes.confirm.exit_message",{qty:r,product:s.produit_nom,lot:s.lot})})},je=async()=>{p.size!==0&&ae(async(s,l)=>{try{W(!0),await O.post("stock-lots/bulk_sortir_perimes/",{lot_ids:Array.from(p),reason:t("stock:perimes.confirm.bulk_exit_title"),validated_by_id:s,sudo_password:l}),N.success(t("perimes.messages.success_bulk_exit",{count:p.size})),P(),Y()}catch(r){throw T.error("Erreur sortie groupée:",r),N.error(oe(r,t("perimes.messages.error_bulk_exit"))),r}finally{W(!1)}},{title:t("perimes.confirm.bulk_exit_title"),message:t("perimes.confirm.bulk_exit_message",{count:p.size})})},ye=s=>{j(l=>{const r=new Set(l);return r.has(s)?r.delete(s):r.add(s),r})},Ne=()=>{const s=c.filter(l=>l.quantity_remaining>0);p.size===s.length?j(new Set):j(new Set(s.map(l=>l.id)))},{printWithTemplate:_e}=Xe(),ve=()=>{if(x.length===0)return;const s=x.reduce((r,G)=>r+(G.valorisation||0),0),l=`
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">${t("stock:perimes.history.title")}</h3>
        <p style="text-align: center; font-size: 0.9em; margin-bottom: 20px;">
          ${t("common:period")}: ${z(I)} ${t("common:to").toLowerCase()} ${z(L)}
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85em;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t("stock:perimes.history.table.date")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t("stock:perimes.history.table.product")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t("stock:perimes.history.table.lot")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t("stock:perimes.history.table.qty")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t("stock:perimes.history.table.value")}</th>
            </tr>
          </thead>
          <tbody>
            ${x.map(r=>`
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${z(r.created_at)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.produit_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.lot_number||"-"}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Math.abs(r.quantity_change)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${u(r.valorisation)}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t("stock:perimes.history.total_valorization").toUpperCase()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #dc2626;">${u(s)}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="text-align: right; font-size: 0.8em; margin-top: 30px;">
          <p>${t("stock:perimes.history_print_generated")} ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;_e(l,{title:t("stock:perimes.history.title"),width:800})},ke=()=>{const s="".replace(/\/$/,"");window.open(`${s}/api/stock-adjustments/export_excel/?reason_type=PERIME&created_at__date__gte=${I}&created_at__date__lte=${L}`,"_blank","noopener,noreferrer")};return e.jsxs("div",{className:"h-full flex flex-col bg-slate-50 overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("div",{className:"p-2.5 bg-red-50 text-red-500 rounded-xl",children:e.jsx(J,{className:"size-6"})}),e.jsxs("div",{children:[e.jsx("h1",{className:"text-xl font-bold tracking-tight text-slate-800",children:t("perimes.title")}),e.jsx("p",{className:"text-[11px] font-medium text-slate-400 uppercase tracking-widest",children:t("perimes.subtitle")})]})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx($e,{value:$,onValueChange:s=>se(s),children:e.jsxs(Ce,{className:"bg-slate-100",children:[e.jsxs(X,{value:"dashboard",className:"gap-1.5 text-xs",children:[e.jsx(ze,{className:"size-3.5"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.dashboard")})]}),e.jsxs(X,{value:"list",className:"gap-1.5 text-xs",children:[e.jsx(De,{className:"size-3.5"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.list")})]}),e.jsxs(X,{value:"history",className:"gap-1.5 text-xs",children:[e.jsx(Te,{className:"size-3.5"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.history")})]})]})}),e.jsxs(k,{variant:"outline",size:"sm",onClick:()=>{P(),Y()},disabled:f||E,className:"gap-2",children:[e.jsx(Ee,{className:R("size-4",(f||E)&&"animate-spin")}),e.jsx("span",{className:"hidden sm:inline",children:t("common:refresh")})]})]})]}),B&&e.jsx("div",{className:"px-6 pt-4 shrink-0",children:e.jsxs("div",{role:"alert",className:"p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-sm font-medium",children:[e.jsx(J,{className:"size-5 shrink-0 mt-0.5"}),e.jsx("span",{children:B})]})}),e.jsx("div",{className:"flex-1 overflow-auto px-6 py-4",children:$==="dashboard"?e.jsx("div",{className:"space-y-6",children:E?e.jsx("div",{className:"flex items-center justify-center py-12",children:e.jsx("span",{className:"size-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin"})}):i?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[e.jsx(w,{className:"bg-gradient-to-br from-red-50 to-red-50/40 border-red-200",children:e.jsx(C,{className:"p-5",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"size-12 rounded-full bg-red-100 flex items-center justify-center text-2xl",children:"💸"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-slate-500",children:t("perimes.stats.valeur_perimes")}),e.jsx("p",{className:"text-2xl font-bold text-red-600",children:u(i.perimes.valeur_cout)}),e.jsx("p",{className:"text-xs text-slate-400",children:t("perimes.stats.lots_count",{count:i.perimes.count_lots})})]})]})})}),e.jsx(w,{className:"bg-gradient-to-br from-amber-50 to-amber-50/40 border-amber-200",children:e.jsx(C,{className:"p-5",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"size-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl",children:"📉"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-slate-500",children:t("perimes.stats.manque_gagner")}),e.jsx("p",{className:"text-2xl font-bold text-amber-600",children:u(i.perimes.valeur_vente_perdue)}),e.jsx("p",{className:"text-xs text-slate-400",children:t("perimes.stats.at_sale_price")})]})]})})}),e.jsx(w,{className:"bg-gradient-to-br from-blue-50 to-blue-50/40 border-blue-200",children:e.jsx(C,{className:"p-5",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"size-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl",children:"📊"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-slate-500",children:t("perimes.stats.taux_perte")}),e.jsxs("p",{className:"text-2xl font-bold text-blue-600",children:[i.indicateurs.taux_perte_pct,"%"]}),e.jsxs("p",{className:"text-xs text-slate-400",children:[t("perimes.stats.vs_ca")," (",u(i.indicateurs.ca_periode),")"]})]})]})})})]}),e.jsxs(w,{children:[e.jsx(le,{children:e.jsxs(ne,{className:"text-lg",children:["⏰ ",t("perimes.prevision.title")]})}),e.jsx(C,{children:e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:["30j","60j","90j"].map((s,l)=>e.jsxs("div",{className:R("border-2 rounded-xl p-4",Ke(i.previsions[s].valeur_vente)),children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"font-bold text-slate-700",children:t("common:count_days",{count:[30,60,90][l]})}),e.jsx(V,{variant:"outline",className:"bg-white/80 text-slate-600",children:t("perimes.prevision.lots_count",{count:i.previsions[s].count_lots})})]}),e.jsx("p",{className:"text-xl font-bold text-slate-800",children:u(i.previsions[s].valeur_vente)}),e.jsx("p",{className:"text-xs text-slate-500 mt-1",children:t("perimes.prevision.potential_risk")})]},s))})})]}),i.perimes.details.length>0&&e.jsxs(w,{className:"overflow-hidden",children:[e.jsx(le,{children:e.jsxs(ne,{className:"text-lg",children:["🚨 ",t("perimes.top_perimes")]})}),e.jsxs(C,{children:[e.jsx("div",{className:"overflow-x-auto",children:e.jsxs(K,{className:"w-full text-sm",children:[e.jsx(Q,{children:e.jsxs(D,{className:"bg-slate-50 hover:bg-slate-50",children:[e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.product")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.lot")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.expiration")}),e.jsx(n,{className:"text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.qty")}),e.jsx(n,{className:"text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.value_cost")}),e.jsx(n,{className:"text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.value_sale")})]})}),e.jsx(Z,{children:i.perimes.details.slice(0,10).map(s=>e.jsxs(D,{className:"hover:bg-slate-50 transition-colors",children:[e.jsx(o,{className:"font-medium px-4 py-2.5 text-slate-700",children:s.produit_nom}),e.jsx(o,{className:"font-mono text-xs px-4 py-2.5 text-slate-500",children:s.lot_numero||"-"}),e.jsx(o,{className:"px-4 py-2.5",children:e.jsx(V,{variant:"outline",className:"bg-red-50 text-red-500 border-red-200",children:s.date_expiration?z(s.date_expiration):"-"})}),e.jsx(o,{className:"text-right font-bold px-4 py-2.5 text-slate-700",children:s.quantity}),e.jsx(o,{className:"text-right px-4 py-2.5 text-red-500 font-medium",children:u(s.valeur_cout)}),e.jsx(o,{className:"text-right px-4 py-2.5 text-amber-600 font-medium",children:u(s.valeur_vente)})]},s.lot_id))})]})}),i.perimes.details.length>10&&e.jsx("div",{className:"mt-3 text-center",children:e.jsxs(k,{variant:"link",size:"sm",onClick:()=>se("list"),children:["Voir tous les ",i.perimes.count_lots," lots →"]})})]})]})]}):e.jsx("div",{className:"text-center py-12 text-slate-400",children:e.jsx("p",{children:t("stock:perimes.no_data")})})}):$==="list"?e.jsxs("div",{className:"flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",children:[e.jsx("div",{className:"p-4 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0",children:e.jsx("div",{className:"flex justify-between items-center h-10",children:p.size>0?e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(Fe,{children:[e.jsx(Be,{asChild:!0,children:e.jsxs(k,{variant:"destructive",size:"sm",className:"gap-2",children:[e.jsx(qe,{className:"size-4"}),t("common:actions_title"),e.jsx(V,{variant:"destructive",className:"bg-red-500",children:p.size})]})}),e.jsxs(Ue,{align:"start",className:"w-48",children:[e.jsx(We,{children:t("common:bulk_actions")}),e.jsx(Ye,{}),e.jsxs(Ge,{onClick:je,className:"text-red-500 focus:bg-red-50 focus:text-red-600",children:[e.jsx(ce,{className:"size-4 mr-2"})," ",t("perimes.table.exit_btn")]})]})]}),e.jsxs(k,{variant:"ghost",size:"sm",onClick:()=>j(new Set),className:"gap-2",children:[e.jsx(Me,{className:"size-4"}),t("common:cancel")]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"p-2 bg-red-50 text-red-500 rounded-lg",children:e.jsx(J,{className:"size-5"})}),e.jsx("h2",{className:"font-bold text-lg tracking-tight text-slate-800",children:t("perimes.risk_lots")}),e.jsx(V,{variant:"secondary",className:"bg-slate-100 text-slate-500",children:c.length})]}),e.jsx("div",{className:"flex gap-3 items-center",children:e.jsxs("div",{className:"flex items-center gap-2 bg-slate-50 p-1 px-3 rounded-xl border border-slate-200",children:[e.jsx("span",{className:"text-[10px] font-bold text-slate-400 uppercase",children:t("common:filters")}),e.jsx("div",{className:"h-4 w-px bg-slate-200 mx-1"}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx(ee,{checked:b,onCheckedChange:s=>q(s===!0),className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"}),e.jsx("span",{className:"text-[11px] font-semibold text-slate-500",children:t("stock:perimes.show_expired_only")})]}),!b&&e.jsxs("select",{className:"rounded-lg border border-slate-200 bg-white h-7 px-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-red-400 transition-all",value:d,onChange:s=>m(parseInt(s.target.value)),children:[e.jsx("option",{value:30,children:t("common:count_days",{count:30})}),e.jsx("option",{value:60,children:t("common:count_days",{count:60})}),e.jsx("option",{value:90,children:t("common:count_days",{count:90})}),e.jsx("option",{value:180,children:t("common:count_days",{count:180})})]})]})})]})})}),e.jsx("div",{className:"flex-1 overflow-auto",children:f?e.jsx("div",{className:"flex items-center justify-center h-64",children:e.jsx("span",{className:"size-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin"})}):c.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center h-64 text-slate-300 gap-4",children:[e.jsx(Ie,{className:"size-16"}),e.jsx("p",{className:"text-sm font-bold uppercase tracking-widest text-slate-400",children:t("perimes.no_result")})]}):e.jsxs(K,{className:"w-full text-xs",children:[e.jsx(Q,{className:"bg-slate-50 sticky top-0 z-30 border-b border-slate-100",children:e.jsxs(D,{className:"text-slate-400 uppercase text-[10px] tracking-widest font-black hover:bg-slate-50",children:[e.jsx(n,{className:"py-3 px-4 w-12 text-center",children:e.jsx(ee,{checked:p.size===c.filter(s=>s.quantity_remaining>0).length&&c.filter(s=>s.quantity_remaining>0).length>0,onCheckedChange:Ne,className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"})}),e.jsx(n,{className:"py-3 px-4 text-left",children:t("perimes.table.product")}),e.jsx(n,{className:"py-3 px-4 text-center",children:t("perimes.table.lot")}),e.jsx(n,{className:"py-3 px-4 text-center",children:t("perimes.table.expiration")}),e.jsx(n,{className:"py-3 px-4 text-left",children:t("perimes.table.provider")}),e.jsx(n,{className:"py-3 px-4 text-right",children:t("perimes.table.stock")}),e.jsx(n,{className:"py-3 px-4 text-right",children:t("perimes.table.value")}),e.jsx(n,{className:"py-3 px-4 text-center",children:t("perimes.table.actions")})]})}),e.jsx(Z,{children:c.map(s=>e.jsxs(D,{className:R("hover:bg-slate-50 transition-colors group",s.quantity_remaining<=0&&"opacity-50",p.has(s.id)&&"bg-red-50/40"),children:[e.jsx(o,{className:"py-2.5 px-4 text-center",children:e.jsx(ee,{checked:p.has(s.id),onCheckedChange:()=>ye(s.id),disabled:s.quantity_remaining<=0,className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"})}),e.jsxs(o,{className:"py-2.5 px-4",children:[e.jsx("div",{className:"font-bold text-sm text-slate-800",children:s.produit_nom}),e.jsxs("div",{className:"text-[10px] font-mono text-slate-400",children:["#",s.produit]})]}),e.jsx(o,{className:"py-2.5 px-4 text-center font-mono text-[11px] font-bold text-slate-500",children:s.lot||"-"}),e.jsx(o,{className:"py-2.5 px-4 text-center",children:e.jsxs(V,{variant:"outline",className:R("gap-1.5",s.date_expiration&&xe(s.date_expiration)?"bg-red-50 text-red-500 border-red-200":"bg-amber-50 text-amber-600 border-amber-200"),children:[e.jsx(Le,{className:"size-3"}),z(s.date_expiration||"")]})}),e.jsx(o,{className:"py-2.5 px-4 text-xs font-semibold text-slate-500 truncate max-w-[140px]",title:s.fournisseur_nom,children:s.fournisseur_nom}),e.jsx(o,{className:"py-2.5 px-4 text-right",children:e.jsx("div",{className:R("font-black text-sm",s.quantity_remaining>0?"text-slate-800":"text-slate-300"),children:s.quantity_remaining})}),e.jsx(o,{className:"py-2.5 px-4 text-right text-red-500 font-mono font-black text-xs",children:u(Number(s.price_cost||0)*s.quantity_remaining)}),e.jsx(o,{className:"py-2.5 px-4 text-center",children:s.quantity_remaining>0?e.jsxs(k,{variant:"outline",size:"sm",className:"gap-1 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100",onClick:()=>fe(s),disabled:be,children:[e.jsx(ce,{className:"size-3.5"}),t("perimes.table.exit_btn")]}):e.jsxs("span",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1",children:[e.jsx(Ae,{className:"size-3"}),t("perimes.table.sorti")]})})]},s.id))})]})})]}):e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex flex-wrap gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200",children:[e.jsxs("div",{className:"flex flex-wrap gap-4 items-center",children:[e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsx("span",{className:"text-[10px] font-bold text-slate-400 uppercase pl-1",children:t("common:from")}),e.jsx(de,{type:"date",className:"h-9 w-auto",value:I,onChange:s=>he(s.target.value)})]}),e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsx("span",{className:"text-[10px] font-bold text-slate-400 uppercase pl-1",children:t("common:to")}),e.jsx(de,{type:"date",className:"h-9 w-auto",value:L,onChange:s=>ue(s.target.value)})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(k,{variant:"outline",size:"sm",onClick:ve,disabled:x.length===0,className:"gap-2",children:[e.jsx(Pe,{className:"size-4"}),t("perimes.history.print")]}),e.jsxs(k,{variant:"default",size:"sm",onClick:ke,disabled:x.length===0,className:"gap-2",children:[e.jsx(He,{className:"size-4"}),t("perimes.history.excel")]})]})]}),x.length>0&&e.jsx(w,{children:e.jsxs(C,{className:"p-4",children:[e.jsx("div",{className:"text-xs font-bold uppercase text-slate-400",children:t("perimes.history.total_valorization")}),e.jsx("div",{className:"text-red-500 text-2xl font-bold",children:u(x.reduce((s,l)=>s+(l.valorisation||0),0))}),e.jsx("div",{className:"text-sm font-medium text-slate-400",children:t("perimes.history.operations_count",{count:x.length})})]})}),y?e.jsx("div",{className:"flex items-center justify-center h-64",children:e.jsx("span",{className:"size-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin"})}):x.length===0?e.jsx("div",{className:"flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl",children:e.jsx("p",{className:"text-lg font-bold",children:t("perimes.history.no_result")})}):e.jsx(w,{className:"overflow-hidden",children:e.jsx("div",{className:"overflow-x-auto",children:e.jsxs(K,{className:"w-full text-sm",children:[e.jsx(Q,{children:e.jsxs(D,{className:"bg-slate-50 hover:bg-slate-50",children:[e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.date")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.product")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.lot")}),e.jsx(n,{className:"text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.qty")}),e.jsx(n,{className:"text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.value")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.user")}),e.jsx(n,{className:"text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.details")})]})}),e.jsx(Z,{children:x.map(s=>e.jsxs(D,{className:"hover:bg-slate-50 transition-colors",children:[e.jsx(o,{className:"text-xs px-4 py-2.5 text-slate-500",children:z(s.created_at)}),e.jsxs(o,{className:"px-4 py-2.5",children:[e.jsx("div",{className:"font-bold text-xs text-slate-800",children:s.produit_name}),e.jsx("div",{className:"text-[10px] text-slate-400 font-mono",children:s.produit_cip})]}),e.jsx(o,{className:"font-mono text-[11px] px-4 py-2.5 text-slate-500",children:s.lot_number||"-"}),e.jsx(o,{className:"text-right font-bold text-red-500 px-4 py-2.5",children:s.quantity_change}),e.jsx(o,{className:"text-right font-bold px-4 py-2.5 text-slate-700",children:u(s.valorisation)}),e.jsx(o,{className:"text-xs px-4 py-2.5 text-slate-500",children:s.user_name}),e.jsxs(o,{className:"text-xs truncate max-w-[150px] px-4 py-2.5 text-slate-500",title:s.reason_detail,children:[t(`stock:ajustements.filters.reasons.${s.reason_type}`,{defaultValue:s.reason_type_display})," ",s.reason_detail?`- ${s.reason_detail}`:""]})]},s.id))})]})})})]})}),e.jsx(Ve,{isOpen:A.isOpen,onClose:ge,onValidate:A.onValidate,title:A.title,message:A.message,saving:A.isValidating})]})}export{bt as default};
