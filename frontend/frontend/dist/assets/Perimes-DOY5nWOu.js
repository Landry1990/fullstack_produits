import{j as e}from"./vendor-query-Dwl67EW6.js";import{u as Q,a}from"./vendor-i18n-Bhcf_hna.js";import{s as Le,y as ye,t as qe,o as q,n as v,k as F,D as pe,T as Me,K as Ae,L as Z,B as S,j as V,S as ee,C as $,l as T,q as b,M as xe,N as me,m as B,A as E,E as he,p as ge}from"./feature-dashboard-DcCv9l4n.js";import{x as j,B as Pe,k as Ie,T as te,a as se,b as L,c as l,d as ae,e as n,C as re,S as ue,l as He}from"./feature-caisse-DTryghKX.js";import{L as be}from"./feature-inventory-editor-CTYTD99D.js";import{D as Oe,f as Re,g as Fe,h as Ve,i as Be,j as Ue}from"./feature-ventes-DopREfOW.js";import{e as ie,m as We,a_ as Ye,d as Je,l as Ke,b0 as Xe,a3 as fe,X as Ge,aq as Qe,s as Ze,a0 as et,ak as tt,J as st}from"./vendor-ui-BBvXwTdP.js";import"./vendor-router-Dhq6pvs1.js";import"./vendor-dates-BrGixsn1.js";import"./vendor-http-n6NG6ckz.js";import"./feature-history-CwNFo6Cl.js";import"./feature-inventory-states-CtPXPKCh.js";import"./vendor-xlsx-CKwrMZHi.js";import"./feature-inventory-A_asWXBy.js";import"./feature-produits-DFr4wIpF.js";import"./feature-settings-O4Dhg3Xo.js";import"./feature-reports-B9vtwzza.js";import"./vendor-pdf-BrHdyR7x.js";import"./feature-commandes-CIIY8ILe.js";function at(){const{settings:t}=Le(),{t:u}=Q("common"),{lang:p,locale:d}=ye(),{t:o}=Q(["common","printing"],{lng:p}),z=a.useRef(null),c=a.useCallback(()=>`
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      svg * { shape-rendering: crispEdges; }
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
    `,[]),U=a.useCallback(()=>t?`
      <div class="print-header">
        <h2>${j(t.pharmacy_name||"PHARMACIE")}</h2>
        ${t.address?`<p>${j(t.address)}</p>`:""}
        ${t.phone?`<p>${j(o("common:phone_short"))}${j(t.phone)}</p>`:""}
        ${t.email?`<p>${j(t.email)}</p>`:""}
        ${t.niu?`<p>NIU: ${j(t.niu)}</p>`:""}
        ${t.registre_commerce?`<p>RC: ${j(t.registre_commerce)}</p>`:""}
        ${t.show_pharmacist_on_documents&&t.pharmacist_name?`<p>${j(o("printing:invoice.pharmacist"))}: ${j(t.pharmacist_name)}</p>`:""}
      </div>
    `:"",[t,o]),k=a.useCallback(x=>{const g=x||t?.ticket_footer_message||o("printing:ticket.visit_thanks");return`
      <div class="print-footer">
        <p>${j(g)}</p>
        <p style="margin-top: 5px; font-size: 0.7em;">
          ${o("common:printed_on")} ${qe(new Date,d)}
        </p>
      </div>
    `},[t,d,o]),y=a.useCallback((x,g={})=>{const{title:f=o("printing:print_page.default_title"),width:M=400,height:h=600,autoClose:N=!0,autoPrint:m=!0,printDelay:A=500}=g,_=window.open("about:blank","",`height=${h},width=${M}`);return _?(Pe(_,x),_.document.title=f,m&&setTimeout(()=>{_.print(),N&&_.close()},A),_):(q.error("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les paramètres du navigateur."),null)},[o]),C=a.useCallback((x,g)=>{y(x,g)},[y]),W=a.useCallback((x,g={})=>{const{showHeader:f=!0,showFooter:M=!0,footerMessage:h,customStyles:N="",...m}=g,A=`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${m.title||o("printing:print_page.default_title")}</title>
          <style>
            ${c()}
            ${N}
          </style>
        </head>
        <body>
          <div class="print-container">
            ${f?U():""}
            ${x}
            ${M?k(h):""}
          </div>
        </body>
      </html>
    `;y(A,m)},[c,U,k,y,o]),Y=a.useCallback(x=>{window.open(x,"_blank")||v.error(u("popup_blocked"))},[u]),J=a.useCallback((x,g)=>{const f=`
      <!DOCTYPE html>
      <html>
        <head>
          <style>${c()}</style>
        </head>
        <body>
          ${x.outerHTML}
        </body>
      </html>
    `;y(f,g)},[c,y]);return{printHTML:C,printWithTemplate:W,openPrintPage:Y,printRef:z,printElement:J}}const Ne=t=>{const u=t.getFullYear(),p=String(t.getMonth()+1).padStart(2,"0"),d=String(t.getDate()).padStart(2,"0");return`${u}-${p}-${d}`},rt=t=>{const[u]=t.split("T"),[p,d]=u.split("-"),o=Number(p),z=Number(d);if(!o||!z)return null;const c=new Date(o,z,0).getDate();return`${p}-${d}-${String(c).padStart(2,"0")}`},it=t=>t>5e5?"border-red-400 bg-red-50":t>1e5?"border-amber-400 bg-amber-50":"border-emerald-400 bg-emerald-50",je=t=>{if(!t)return!1;const u=rt(t);if(!u)return!1;const p=Ne(new Date);return u<p};function wt(){const{t}=Q(["stock","common"]),{lang:u,locale:p}=ye(),{t:d}=Q(["stock","common"],{lng:u}),[o,z]=a.useState([]),[c,U]=a.useState(null),[k,y]=a.useState(!1),[C,W]=a.useState(!1),[Y,J]=a.useState(null),[x,g]=a.useState(30),[f,M]=a.useState(!0),[h,N]=a.useState(new Set),[m,A]=a.useState([]),[_,le]=a.useState(!1),[D,ne]=a.useState("dashboard"),[P,_e]=a.useState(()=>{const s=new Date;return s.setMonth(s.getMonth()-1),s.toISOString().split("T")[0]}),[I,ve]=a.useState(()=>new Date().toISOString().split("T")[0]),{sudoState:H,requireSudo:oe,closeSudo:ke}=Ie(),[we,K]=a.useState(!1);a.useEffect(()=>{X(),O(),ce()},[]),a.useEffect(()=>{D==="list"?O():D==="history"&&ce()},[x,f,D,P,I]);const X=async()=>{W(!0);try{const s=await F.get("stock-lots/stats_perimes/");U(s.data)}catch(s){q.error("Erreur chargement stats:",s),v.error(t("perimes.messages.error_stats"))}finally{W(!1)}},ce=async()=>{le(!0);try{const i=(await F.get("stock-adjustments/",{params:{reason_type:"PERIME",created_at__gte:P,created_at__lte:pe(new Date(I+"T00:00:00")),page_size:100}})).data;A(Array.isArray(i)?i:i.results||[])}catch(s){q.error("Erreur chargement historiques:",s),v.error(t("perimes.messages.error_history"))}finally{le(!1)}},O=async()=>{y(!0),J(null),N(new Set);try{const s=new Date,i=new Date;i.setDate(s.getDate()+x);const r=Ne(i),R=(await F.get("stock-lots/",{params:{date_expiration_lte:r,include_empty:"false"}})).data;let w=Array.isArray(R)?R:R.results||[];f&&(w=w.filter(de=>!!de.date_expiration&&je(de.date_expiration))),z(w)}catch(s){q.error("Erreur chargement lots:",s),J(t("perimes.messages.error_loading"))}finally{y(!1)}},Se=async s=>{const i=prompt(t("perimes.prompt.qty",{lot:s.lot,max:s.quantity_remaining}),String(s.quantity_remaining));if(!i)return;const r=parseInt(i,10);if(isNaN(r)||r<=0||r>s.quantity_remaining){v.error(t("perimes.messages.invalid_qty"));return}oe(async(G,R)=>{try{K(!0),await F.post(`stock-lots/${s.id}/sortir_perimes/`,{quantity:r,reason:t("stock:ajustements.filters.reasons.PERIME")+" / "+t("stock:ajustements.filters.reasons.AVARIE"),validated_by_id:G,sudo_password:R}),v.success(t("perimes.messages.success_exit")),O(),X()}catch(w){throw q.error("Erreur sortie stock:",w),v.error(t("perimes.messages.error_exit")+": "+ge(w,t("common:messages.error_generic"))),w}finally{K(!1)}},{title:t("perimes.confirm.exit_title"),message:t("perimes.confirm.exit_message",{qty:r,product:s.produit_nom,lot:s.lot})})},$e=async()=>{h.size!==0&&oe(async(s,i)=>{try{K(!0),await F.post("stock-lots/bulk_sortir_perimes/",{lot_ids:Array.from(h),reason:t("stock:perimes.confirm.bulk_exit_title"),validated_by_id:s,sudo_password:i}),v.success(t("perimes.messages.success_bulk_exit",{count:h.size})),O(),X()}catch(r){throw q.error("Erreur sortie groupée:",r),v.error(ge(r,t("perimes.messages.error_bulk_exit"))),r}finally{K(!1)}},{title:t("perimes.confirm.bulk_exit_title"),message:t("perimes.confirm.bulk_exit_message",{count:h.size})})},ze=s=>{N(i=>{const r=new Set(i);return r.has(s)?r.delete(s):r.add(s),r})},Ce=()=>{const s=o.filter(i=>i.quantity_remaining>0);h.size===s.length?N(new Set):N(new Set(s.map(i=>i.id)))},{printWithTemplate:De}=at(),Te=()=>{if(m.length===0)return;const s=m.reduce((r,G)=>r+(G.valorisation||0),0),i=`
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">${d("stock:perimes.history.title")}</h3>
        <p style="text-align: center; font-size: 0.9em; margin-bottom: 20px;">
          ${d("common:period")}: ${E(P,p)} ${d("common:to").toLowerCase()} ${E(I,p)}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85em;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${d("stock:perimes.history.table.date")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${d("stock:perimes.history.table.product")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${d("stock:perimes.history.table.lot")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${d("stock:perimes.history.table.qty")}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${d("stock:perimes.history.table.value")}</th>
            </tr>
          </thead>
          <tbody>
            ${m.map(r=>`
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${E(r.created_at,p)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.produit_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.lot_number||"-"}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Math.abs(r.quantity_change)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${b(r.valorisation,p)}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">${d("stock:perimes.history.total_valorization").toUpperCase()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #dc2626;">${b(s,p)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: right; font-size: 0.8em; margin-top: 30px;">
          <p>${d("stock:perimes.history_print_generated")} ${new Date().toLocaleString(p)}</p>
        </div>
      </div>
    `;De(i,{title:d("stock:perimes.history.title"),width:800})},Ee=()=>{const s="".replace(/\/$/,"");window.open(`${s}/api/stock-adjustments/export_excel/?reason_type=PERIME&created_at__gte=${P}&created_at__lte=${pe(new Date(I+"T00:00:00"))}`,"_blank","noopener,noreferrer")};return e.jsxs("div",{className:"h-full flex flex-col bg-slate-50 overflow-hidden max-w-[1600px] mx-auto w-full",children:[e.jsxs("div",{className:"flex items-center justify-between px-3 lg:px-6 py-2 lg:py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-2 lg:gap-4",children:[e.jsx("div",{className:"p-1.5 lg:p-2.5 bg-red-50 text-red-500 rounded-lg lg:rounded-xl",children:e.jsx(ie,{className:"size-5 lg:size-6"})}),e.jsxs("div",{children:[e.jsx("h1",{className:"text-base lg:text-xl font-bold tracking-tight text-slate-800",children:t("perimes.title")}),e.jsx("p",{className:"text-label font-medium text-slate-400 uppercase tracking-widest hidden lg:block",children:t("perimes.subtitle")})]})]}),e.jsxs("div",{className:"flex items-center gap-2 lg:gap-3",children:[e.jsx(Me,{value:D,onValueChange:s=>ne(s),children:e.jsxs(Ae,{className:"bg-slate-100",children:[e.jsxs(Z,{value:"dashboard",className:"gap-1.5 text-xs","aria-label":t("perimes.tabs.dashboard"),children:[e.jsx(We,{className:"size-3.5","aria-hidden":"true"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.dashboard")})]}),e.jsxs(Z,{value:"list",className:"gap-1.5 text-xs","aria-label":t("perimes.tabs.list"),children:[e.jsx(Ye,{className:"size-3.5","aria-hidden":"true"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.list")})]}),e.jsxs(Z,{value:"history",className:"gap-1.5 text-xs","aria-label":t("perimes.tabs.history"),children:[e.jsx(Je,{className:"size-3.5","aria-hidden":"true"}),e.jsx("span",{className:"hidden sm:inline font-semibold",children:t("perimes.tabs.history")})]})]})}),e.jsxs(S,{variant:"outline",size:"sm",onClick:()=>{O(),X()},disabled:k||C,className:"gap-2","aria-label":t("common:refresh"),"aria-busy":k||C,children:[e.jsx(Ke,{className:V("size-4",(k||C)&&"animate-spin"),"aria-hidden":"true"}),e.jsx("span",{className:"hidden sm:inline",children:t("common:refresh")})]})]})]}),Y&&e.jsx("div",{className:"px-3 lg:px-6 pt-2 lg:pt-4 shrink-0",children:e.jsxs("div",{role:"alert",className:"p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-sm font-medium",children:[e.jsx(ie,{className:"size-5 shrink-0 mt-0.5"}),e.jsx("span",{children:Y})]})}),e.jsx("div",{className:"flex-1 overflow-auto px-3 lg:px-6 py-2 lg:py-4",children:D==="dashboard"?e.jsx("div",{className:"space-y-4 lg:space-y-6",children:C?e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4",children:[e.jsx(ee,{className:"h-24 w-full rounded-xl"}),e.jsx(ee,{className:"h-24 w-full rounded-xl"}),e.jsx(ee,{className:"h-24 w-full rounded-xl"})]}):c?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4",children:[e.jsx($,{className:"bg-gradient-to-br from-red-50 to-red-50/40 border-red-200",children:e.jsx(T,{className:"p-3 lg:p-5",children:e.jsxs("div",{className:"flex items-center gap-2 lg:gap-3",children:[e.jsx("div",{className:"size-10 lg:size-12 rounded-full bg-red-100 flex items-center justify-center text-xl lg:text-2xl",children:"💸"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs lg:text-sm text-slate-500",children:t("perimes.stats.valeur_perimes")}),e.jsx("p",{className:"text-lg lg:text-2xl font-bold text-red-600",children:b(c.perimes.valeur_cout)}),e.jsx("p",{className:"text-xs text-slate-400",children:t("perimes.stats.lots_count",{count:c.perimes.count_lots})})]})]})})}),e.jsx($,{className:"bg-gradient-to-br from-amber-50 to-amber-50/40 border-amber-200",children:e.jsx(T,{className:"p-3 lg:p-5",children:e.jsxs("div",{className:"flex items-center gap-2 lg:gap-3",children:[e.jsx("div",{className:"size-10 lg:size-12 rounded-full bg-amber-100 flex items-center justify-center text-xl lg:text-2xl",children:"📉"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs lg:text-sm text-slate-500",children:t("perimes.stats.manque_gagner")}),e.jsx("p",{className:"text-lg lg:text-2xl font-bold text-amber-600",children:b(c.perimes.valeur_vente_perdue)}),e.jsx("p",{className:"text-xs text-slate-400",children:t("perimes.stats.at_sale_price")})]})]})})}),e.jsx($,{className:"bg-gradient-to-br from-blue-50 to-blue-50/40 border-blue-200",children:e.jsx(T,{className:"p-3 lg:p-5",children:e.jsxs("div",{className:"flex items-center gap-2 lg:gap-3",children:[e.jsx("div",{className:"size-10 lg:size-12 rounded-full bg-blue-100 flex items-center justify-center text-xl lg:text-2xl",children:"📊"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs lg:text-sm text-slate-500",children:t("perimes.stats.taux_perte")}),e.jsxs("p",{className:"text-lg lg:text-2xl font-bold text-blue-600",children:[c.indicateurs.taux_perte_pct,"%"]}),e.jsxs("p",{className:"text-xs text-slate-400",children:[t("perimes.stats.vs_ca")," (",b(c.indicateurs.ca_periode),")"]})]})]})})})]}),e.jsxs($,{children:[e.jsx(xe,{children:e.jsxs(me,{className:"text-lg",children:["⏰ ",t("perimes.prevision.title")]})}),e.jsx(T,{children:e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4",children:["30j","60j","90j"].map((s,i)=>e.jsxs("div",{className:V("border-2 rounded-xl p-3 lg:p-4",it(c.previsions[s].valeur_vente)),children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"font-bold text-slate-700",children:t("common:count_days",{count:[30,60,90][i]})}),e.jsx(B,{variant:"outline",className:"bg-white/80 text-slate-600",children:t("perimes.prevision.lots_count",{count:c.previsions[s].count_lots})})]}),e.jsx("p",{className:"text-lg lg:text-xl font-bold text-slate-800",children:b(c.previsions[s].valeur_vente)}),e.jsx("p",{className:"text-xs text-slate-500 mt-1",children:t("perimes.prevision.potential_risk")})]},s))})})]}),c.perimes.details.length>0&&e.jsxs($,{className:"overflow-hidden",children:[e.jsx(xe,{children:e.jsxs(me,{className:"text-lg",children:["🚨 ",t("perimes.top_perimes")]})}),e.jsxs(T,{children:[e.jsx("div",{className:"overflow-x-auto",children:e.jsxs(te,{className:"w-full text-sm",children:[e.jsx(se,{children:e.jsxs(L,{className:"bg-slate-50 hover:bg-slate-50",children:[e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.product")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.lot")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.expiration")}),e.jsx(l,{className:"text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.qty")}),e.jsx(l,{className:"text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.value_cost")}),e.jsx(l,{className:"text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.table.value_sale")})]})}),e.jsx(ae,{children:c.perimes.details.slice(0,10).map(s=>e.jsxs(L,{className:"hover:bg-slate-50 transition-colors",children:[e.jsx(n,{className:"font-medium px-4 py-2.5 text-slate-700",children:s.produit_nom}),e.jsx(n,{className:"font-mono text-xs px-4 py-2.5 text-slate-500",children:s.lot_numero||"-"}),e.jsx(n,{className:"px-4 py-2.5",children:e.jsx(B,{variant:"outline",className:"bg-red-50 text-red-500 border-red-200",children:s.date_expiration?E(s.date_expiration):"-"})}),e.jsx(n,{className:"text-right font-bold px-4 py-2.5 text-slate-700",children:s.quantity}),e.jsx(n,{className:"text-right px-4 py-2.5 text-red-500 font-medium",children:b(s.valeur_cout)}),e.jsx(n,{className:"text-right px-4 py-2.5 text-amber-600 font-medium",children:b(s.valeur_vente)})]},s.lot_id))})]})}),c.perimes.details.length>10&&e.jsx("div",{className:"mt-3 text-center",children:e.jsx(S,{variant:"link",size:"sm",onClick:()=>ne("list"),children:t("perimes.view_all_lots",{count:c.perimes.count_lots})})})]})]})]}):e.jsx("div",{className:"text-center py-12 text-slate-400",children:e.jsx("p",{children:t("stock:perimes.no_data")})})}):D==="list"?e.jsxs("div",{className:"flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",children:[e.jsx("div",{className:"p-2 lg:p-4 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0",children:e.jsx("div",{className:"flex flex-wrap justify-between items-center gap-2 min-h-10 py-1",children:h.size>0?e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(Oe,{children:[e.jsx(Re,{asChild:!0,children:e.jsxs(S,{variant:"destructive",size:"sm",className:"gap-2",children:[e.jsx(Xe,{className:"size-4"}),t("common:actions_title"),e.jsx(B,{variant:"destructive",className:"bg-red-500",children:h.size})]})}),e.jsxs(Fe,{align:"start",className:"w-48",children:[e.jsx(Ve,{children:t("common:bulk_actions")}),e.jsx(Be,{}),e.jsxs(Ue,{onClick:$e,className:"text-red-500 focus:bg-red-50 focus:text-red-600",children:[e.jsx(fe,{className:"size-4 mr-2"})," ",t("perimes.table.exit_btn")]})]})]}),e.jsxs(S,{variant:"ghost",size:"sm",onClick:()=>N(new Set),className:"gap-2",children:[e.jsx(Ge,{className:"size-4"}),t("common:cancel")]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"p-1.5 lg:p-2 bg-red-50 text-red-500 rounded-lg",children:e.jsx(ie,{className:"size-4 lg:size-5"})}),e.jsx("h2",{className:"font-bold text-base lg:text-lg tracking-tight text-slate-800",children:t("perimes.risk_lots")}),e.jsx(B,{variant:"secondary",className:"bg-slate-100 text-slate-500",children:o.length})]}),e.jsx("div",{className:"flex gap-3 items-center",children:e.jsxs("div",{className:"flex items-center gap-2 bg-slate-50 p-1 px-3 rounded-xl border border-slate-200",children:[e.jsx("span",{className:"text-caption font-bold text-slate-400 uppercase",children:t("common:filters")}),e.jsx("div",{className:"h-4 w-px bg-slate-200 mx-1"}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx(re,{checked:f,onCheckedChange:s=>M(s===!0),className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"}),e.jsx("span",{className:"text-label font-semibold text-slate-500",children:t("stock:perimes.show_expired_only")})]}),!f&&e.jsxs("select",{className:"rounded-lg border border-slate-200 bg-white h-7 px-2 text-label font-bold text-slate-700 focus:outline-none focus:border-red-400 transition-all","aria-label":t("common:filters"),value:x,onChange:s=>g(parseInt(s.target.value)),children:[e.jsx("option",{value:30,children:t("common:count_days",{count:30})}),e.jsx("option",{value:60,children:t("common:count_days",{count:60})}),e.jsx("option",{value:90,children:t("common:count_days",{count:90})}),e.jsx("option",{value:180,children:t("common:count_days",{count:180})})]})]})})]})})}),e.jsx("div",{className:"flex-1 overflow-auto",children:k?e.jsx(ue,{rows:8,columns:8}):o.length===0?e.jsx(he,{icon:e.jsx(Qe,{className:"size-8"}),title:t("perimes.no_result"),className:"h-64"}):e.jsxs(te,{className:"w-full text-xs",children:[e.jsx(se,{className:"bg-slate-50 sticky top-0 z-30 border-b border-slate-100",children:e.jsxs(L,{className:"text-slate-400 uppercase text-caption tracking-widest font-black hover:bg-slate-50",children:[e.jsx(l,{className:"py-3 px-4 w-12 text-center",children:e.jsx(re,{checked:h.size===o.filter(s=>s.quantity_remaining>0).length&&o.filter(s=>s.quantity_remaining>0).length>0,onCheckedChange:Ce,className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500","aria-label":t("stock:cadencier.select_all")})}),e.jsx(l,{className:"py-3 px-4 text-left",children:t("perimes.table.product")}),e.jsx(l,{className:"py-3 px-4 text-center",children:t("perimes.table.lot")}),e.jsx(l,{className:"py-3 px-4 text-center",children:t("perimes.table.expiration")}),e.jsx(l,{className:"py-3 px-4 text-left",children:t("perimes.table.provider")}),e.jsx(l,{className:"py-3 px-4 text-right",children:t("perimes.table.stock")}),e.jsx(l,{className:"py-3 px-4 text-right",children:t("perimes.table.value")}),e.jsx(l,{className:"py-3 px-4 text-center",children:t("perimes.table.actions")})]})}),e.jsx(ae,{children:o.map(s=>e.jsxs(L,{className:V("hover:bg-slate-50 transition-colors group",s.quantity_remaining<=0&&"opacity-50",h.has(s.id)&&"bg-red-50/40"),children:[e.jsx(n,{className:"py-2.5 px-4 text-center",children:e.jsx(re,{checked:h.has(s.id),onCheckedChange:()=>ze(s.id),disabled:s.quantity_remaining<=0,className:"data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500","aria-label":t("stock:reappro.select_product_aria",{name:s.produit_nom})})}),e.jsxs(n,{className:"py-2.5 px-4",children:[e.jsx("div",{className:"font-bold text-sm text-slate-800",children:s.produit_nom}),e.jsxs("div",{className:"text-caption font-mono text-slate-400",children:["#",s.produit]})]}),e.jsx(n,{className:"py-2.5 px-4 text-center font-mono text-label font-bold text-slate-500",children:s.lot||"-"}),e.jsx(n,{className:"py-2.5 px-4 text-center",children:e.jsxs(B,{variant:"outline",className:V("gap-1.5",s.date_expiration&&je(s.date_expiration)?"bg-red-50 text-red-500 border-red-200":"bg-amber-50 text-amber-600 border-amber-200"),children:[e.jsx(Ze,{className:"size-3"}),E(s.date_expiration||"")]})}),e.jsx(n,{className:"py-2.5 px-4 text-xs font-semibold text-slate-500 truncate max-w-[140px]",title:s.fournisseur_nom,children:s.fournisseur_nom}),e.jsx(n,{className:"py-2.5 px-4 text-right",children:e.jsx("div",{className:V("font-black text-sm",s.quantity_remaining>0?"text-slate-800":"text-slate-300"),children:s.quantity_remaining})}),e.jsx(n,{className:"py-2.5 px-4 text-right text-red-500 font-mono font-black text-xs",children:b(Number(s.price_cost||0)*s.quantity_remaining)}),e.jsx(n,{className:"py-2.5 px-4 text-center",children:s.quantity_remaining>0?e.jsxs(S,{variant:"outline",size:"sm",className:"gap-1 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100",onClick:()=>Se(s),disabled:we,children:[e.jsx(fe,{className:"size-3.5"}),t("perimes.table.exit_btn")]}):e.jsxs("span",{className:"text-caption font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1",children:[e.jsx(et,{className:"size-3"}),t("perimes.table.sorti")]})})]},s.id))})]})})]}):e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex flex-wrap gap-2 lg:gap-4 items-center justify-between bg-slate-50 p-3 lg:p-4 rounded-xl border border-slate-200",children:[e.jsxs("div",{className:"flex flex-wrap gap-2 lg:gap-4 items-center",children:[e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsx("span",{className:"text-caption font-bold text-slate-400 uppercase pl-1",children:t("common:from")}),e.jsx(be,{className:"h-9 w-auto","aria-label":t("common:from"),value:P,onChange:s=>_e(s.target.value)})]}),e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsx("span",{className:"text-caption font-bold text-slate-400 uppercase pl-1",children:t("common:to")}),e.jsx(be,{className:"h-9 w-auto","aria-label":t("common:to"),value:I,onChange:s=>ve(s.target.value)})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(S,{variant:"outline",size:"sm",onClick:Te,disabled:m.length===0,className:"gap-2",children:[e.jsx(tt,{className:"size-4"}),t("perimes.history.print")]}),e.jsxs(S,{variant:"default",size:"sm",onClick:Ee,disabled:m.length===0,className:"gap-2",children:[e.jsx(st,{className:"size-4"}),t("perimes.history.excel")]})]})]}),m.length>0&&e.jsx($,{children:e.jsxs(T,{className:"p-4",children:[e.jsx("div",{className:"text-xs font-bold uppercase text-slate-400",children:t("perimes.history.total_valorization")}),e.jsx("div",{className:"text-red-500 text-2xl font-bold",children:b(m.reduce((s,i)=>s+(i.valorisation||0),0))}),e.jsx("div",{className:"text-sm font-medium text-slate-400",children:t("perimes.history.operations_count",{count:m.length})})]})}),_?e.jsx(ue,{rows:6,columns:7}):m.length===0?e.jsx(he,{title:t("perimes.history.no_result"),className:"h-64 border-2 border-dashed border-slate-200 rounded-2xl"}):e.jsx($,{className:"overflow-hidden",children:e.jsx("div",{className:"overflow-x-auto",children:e.jsxs(te,{className:"w-full text-sm",children:[e.jsx(se,{children:e.jsxs(L,{className:"bg-slate-50 hover:bg-slate-50",children:[e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.date")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.product")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.lot")}),e.jsx(l,{className:"text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.qty")}),e.jsx(l,{className:"text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.value")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.user")}),e.jsx(l,{className:"text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400",children:t("perimes.history.table.details")})]})}),e.jsx(ae,{children:m.map(s=>e.jsxs(L,{className:"hover:bg-slate-50 transition-colors",children:[e.jsx(n,{className:"text-xs px-4 py-2.5 text-slate-500",children:E(s.created_at)}),e.jsxs(n,{className:"px-4 py-2.5",children:[e.jsx("div",{className:"font-bold text-xs text-slate-800",children:s.produit_name}),e.jsx("div",{className:"text-caption text-slate-400 font-mono",children:s.produit_cip})]}),e.jsx(n,{className:"font-mono text-label px-4 py-2.5 text-slate-500",children:s.lot_number||"-"}),e.jsx(n,{className:"text-right font-bold text-red-500 px-4 py-2.5",children:s.quantity_change}),e.jsx(n,{className:"text-right font-bold px-4 py-2.5 text-slate-700",children:b(s.valorisation)}),e.jsx(n,{className:"text-xs px-4 py-2.5 text-slate-500",children:s.user_name}),e.jsxs(n,{className:"text-xs truncate max-w-[150px] px-4 py-2.5 text-slate-500",title:s.reason_detail,children:[t(`stock:ajustements.filters.reasons.${s.reason_type}`,{defaultValue:s.reason_type_display})," ",s.reason_detail?`- ${s.reason_detail}`:""]})]},s.id))})]})})})]})}),e.jsx(He,{isOpen:H.isOpen,onClose:ke,onValidate:H.onValidate,title:H.title,message:H.message,saving:H.isValidating})]})}export{wt as default};
