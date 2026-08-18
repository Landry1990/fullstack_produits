import{j as e}from"./vendor-query-C4s2QFJO.js";import{q as x}from"./feature-dashboard-BpV9dUD2.js";import{P as p,w as b,l as a}from"./feature-caisse-DKOB3AQo.js";import{u as f}from"./vendor-i18n-B5kTFDuS.js";import"./vendor-router-DJ94QBQg.js";import"./vendor-ui-4T-vgA-y.js";import"./vendor-dates-BrGixsn1.js";import"./vendor-http-Dqv9vB22.js";function _({isOpen:o,onClose:l,coupon:t,factureForCoupon:n,onAppliquer:d,settings:i}){const{t:s}=f("caisse"),m=()=>{if(!t)return;const r=window.open("about:blank","","height=600,width=400");if(r){const c=new Date(t.date_creation).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});b(r,`<!DOCTYPE html>
<html>
<head>
  <title>Coupon de Monnaie</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10mm 5mm;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 10mm 5mm;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .pharmacy-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .pharmacy-info {
      font-size: 10px;
      line-height: 1.3;
    }
    .coupon-box {
      border: 2px dashed #000;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
    }
    .coupon-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .coupon-number {
      font-size: 24px;
      font-weight: bold;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
    }
    .coupon-amount {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
      color: #000;
    }
    .info-section {
      margin-top: 15px;
      font-size: 10px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .info-label {
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid #000;
      font-size: 9px;
      margin-left: 5px;
    }
    .notes {
      margin-top: 12px;
      padding: 8px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      font-size: 9px;
      font-style: italic;
      text-align: left;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-size: 9px;
    }
    .warning {
      font-size: 9px;
      color: #666;
      margin-top: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pharmacy-name">${a(i.pharmacy_name||"PHARMACIE")}</div>
    <div class="pharmacy-info">
      ${i.city?`${a(i.city)}`:""}${i.country?`, ${a(i.country)}`:""}<br>
      ${i.phone?`Tel: ${a(i.phone)}`:""}<br>
      ${i.niu?`NIU: ${a(i.niu)}`:""}<br>
      ${i.registre_commerce?`RC: ${a(i.registre_commerce)}`:""}
    </div>
  </div>
  
  <div class="coupon-box">
    <div class="coupon-label">Coupon de Monnaie</div>
    <div class="coupon-number">#${a(t.numero)}</div>
    <div class="coupon-amount">${x(Math.round(Number(t.montant)))}</div>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Statut:</span>
      <span>${a(t.status_display||t.status)}<span class="status-badge">${a(t.status)}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">Généré par:</span>
      <span>${a(t.cree_par_nom||"Système")}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date:</span>
      <span>${c}</span>
    </div>
    ${t.facture_origine?`
    <div class="info-row">
      <span class="info-label">Facture origine:</span>
      <span>#${a(t.facture_origine)}</span>
    </div>
    `:""}
  </div>
  
  ${t.notes?`
  <div class="notes">
    <strong>Notes:</strong><br>
    ${a(t.notes)}
  </div>
  `:""}
  
  <div class="warning">
    Ce coupon est valable uniquement dans cette pharmacie
  </div>
  
  <div class="footer">
    ${a(i.ticket_footer_message||"Merci de votre visite !")}
  </div>
</body>
</html>`),r.onload=()=>{setTimeout(()=>{r.print()},250)}}};return e.jsx(p,{isOpen:o&&!!t,onClose:l,title:s("coupons.details_modal.title"),icon:e.jsx("span",{className:"text-emerald-600 text-xl",children:"🎫"}),footer:e.jsxs("div",{className:"flex justify-between gap-2 w-full",children:[e.jsx("button",{className:"inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors",onClick:m,children:s("coupons.details_modal.print")}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors",onClick:l,children:s("coupons.details_modal.close")||"Fermer"}),t&&t.status==="ACTIF"&&n&&e.jsxs("button",{className:"inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors",onClick:()=>d(t,n),children:[s("table.apply_coupon")," #",n.session_ticket_number]}),t&&t.status==="ACTIF"&&!n&&e.jsx("div",{className:"text-xs text-amber-600",children:s("coupons.select_sale_first")})]})]}),children:e.jsx("div",{className:"p-6",children:t&&e.jsxs("div",{className:"text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50",children:[e.jsx("div",{className:"text-xs font-bold text-slate-400 uppercase tracking-widest mb-1",children:s("coupons.coupon_label")}),e.jsxs("div",{className:"text-4xl font-black text-emerald-600 font-mono mb-2",children:["#",t.numero]}),e.jsxs("div",{className:"text-3xl font-bold text-slate-800 mb-4",children:[Math.round(Number(t.montant))," F"]}),e.jsx("div",{className:"border-t border-slate-200 my-2"}),e.jsxs("div",{className:"text-left space-y-2 text-xs text-slate-700",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsxs("span",{children:[s("coupons.headers.status"),":"]}),e.jsx("span",{className:`inline-flex items-center px-2 h-5 text-[10px] rounded font-semibold ${t.status==="ACTIF"?"bg-emerald-100 text-emerald-700":t.status==="UTILISE"?"bg-slate-100 text-slate-700":"bg-slate-50 text-slate-500"}`,children:t.status_display||t.status})]}),e.jsx("div",{className:"border-t border-slate-200 my-1"}),e.jsxs("div",{className:"bg-white p-2 rounded border border-slate-200 space-y-1",children:[e.jsx("div",{className:"font-bold text-[10px] uppercase text-slate-500 mb-1",children:s("coupons.creation")}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:s("coupons.generated_by")}),e.jsx("span",{className:"font-medium",children:t.cree_par_nom||s("coupons.system")})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:s("table.date_time")}),e.jsx("span",{className:"font-medium",children:new Date(t.date_creation).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})})]})]}),t.status==="UTILISE"&&e.jsxs("div",{className:"bg-emerald-50 p-2 rounded border border-emerald-100 space-y-1",children:[e.jsx("div",{className:"font-bold text-[10px] uppercase text-emerald-600 text-slate-500 mb-1",children:s("coupons.headers.usage")}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:s("coupons.used_by")}),e.jsx("span",{className:"font-medium",children:t.utilise_par_nom||s("coupons.na")})]}),t.date_utilisation&&e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:s("table.date_time")}),e.jsx("span",{children:new Date(t.date_utilisation).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})})]})]}),t.notes&&e.jsxs("div",{className:"mt-2 p-2 bg-white rounded italic border border-slate-200 text-slate-600",children:[e.jsxs("span",{className:"font-bold not-italic text-slate-500 block text-[10px] mb-1",children:[s("coupons.notes_label"),":"]}),'"',t.notes,'"']})]})]})})})}export{_ as CouponDetailsModal};
