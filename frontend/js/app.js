/* ── Globals ─────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtN = n => { const v = parseFloat(n)||0; return v%1===0 ? v.toString() : v.toFixed(2); };
const fmtD = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}.${m}.${y}`; };
const todayStr = () => new Date().toISOString().slice(0,10);
const genId = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const fileIcon = n => { const e=(n||'').split('.').pop().toLowerCase(); return {jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',pdf:'📄',docx:'📝',doc:'📝',xlsx:'📊',xls:'📊'}[e]||'📎'; };

const PAGE_META = {
  dashboard: { title:'Главная',    icon:'🏠', section:'Обзор' },
  products:  { title:'Продукция',  icon:'🎂', section:'Производство' },
  plan:      { title:'План',       icon:'📊', section:'Производство' },
  raw:       { title:'Сырьё',      icon:'🌾', section:'Производство' },
  pkg:       { title:'Упаковка',   icon:'📦', section:'Производство' },
  requests:  { title:'Заявки',     icon:'📬', section:'Сбыт' },
  calendar:  { title:'Календарь',  icon:'📅', section:'Журнал' },
  rbac:      { title:'Роли и пользователи', icon:'🔐', section:'Система' },
};

let S = {
  me: null, pages: [],
  raw:[], pkg:[], events:[], products:[], plan:[], production:[], requests:[],
  users:[], roles:[],
  page: 'dashboard',
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
};

/* ── Utils ────────────────────────────────────────────────────────────────── */
function toast(msg, type='') {
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 2600);
}
function setLoad(on) { $('loader').style.display = on ? 'flex' : 'none'; }
function openModal(id)  { $(id)?.classList.add('open'); }
function closeModal(id) { $(id)?.classList.remove('open'); }
window.closeModal = closeModal;

document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); })
);

/* ── Navigation ────────────────────────────────────────────────────────────── */
function buildNav() {
  const nav = $('nav-items');
  // Group by section
  const sections = {};
  S.pages.forEach(p => {
    const m = PAGE_META[p]; if(!m) return;
    if(!sections[m.section]) sections[m.section] = [];
    sections[m.section].push({ id: p, ...m });
  });
  nav.innerHTML = Object.entries(sections).map(([sec, items]) => `
    <div class="nav-section">${esc(sec)}</div>
    ${items.map(p => `
      <div class="nav-item" data-page="${p.id}">
        <span class="nav-icon">${p.icon}</span>${esc(p.title)}
        ${p.id==='requests' ? '<span class="nav-badge" id="nav-req-badge" style="display:none">0</span>' : ''}
      </div>`).join('')}
  `).join('');
  nav.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigateTo(el.dataset.page))
  );
}

function navigateTo(page) {
  if (!S.pages.includes(page)) return;
  S.page = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page===page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id==='page-'+page));
  $('topbar-title').textContent = PAGE_META[page]?.title || page;
  // Update add-btn visibility
  const noAdd = ['dashboard','rbac'];
  $('add-btn').style.display = noAdd.includes(page) ? 'none' : '';
  // Render
  if(page==='dashboard') renderDashboard();
  if(page==='plan')      renderPlan();
  if(page==='calendar')  renderCalendar();
  if(page==='requests')  renderRequests();
  if(page==='rbac')      renderRBAC();
}

$('add-btn').addEventListener('click', () => {
  const map = { raw:openRawModal, pkg:openPkgModal, products:openProductModal,
                plan:openPlanModal, calendar:openEventModal, requests:openRequestModal };
  map[S.page]?.();
});

$('search-input').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  if(S.page==='raw')      renderRaw(q);
  if(S.page==='pkg')      renderPkg(q);
  if(S.page==='products') renderProducts(q);
});

/* ── Dashboard ────────────────────────────────────────────────────────────── */
function renderDashboard() {
  const pending = S.requests.filter(r=>r.status==='new').length;
  const lowRaw  = S.raw.filter(r=>r.min>0&&r.qty<=r.min).length;
  const lowPkg  = S.pkg.filter(p=>p.min>0&&p.qty<=p.min).length;
  const todayProd = S.production.filter(p=>p.date===todayStr()).reduce((s,p)=>s+(parseFloat(p.qty)||0),0);
  const planToday = S.plan.filter(p=>p.date===todayStr()).map(p=>{
    const done = S.production.filter(x=>x.productId===p.productId&&x.date===p.date).reduce((s,x)=>s+(parseFloat(x.qty)||0),0);
    return {...p, done};
  });
  $('dashboard-content').innerHTML = `
    <div class="stats-strip">
      <div class="stat-card"><div class="stat-label">Выпуск сегодня</div><div class="stat-value">${fmtN(todayProd)}</div><div class="stat-sub">штук</div></div>
      <div class="stat-card"><div class="stat-label">Заявки в ожидании</div><div class="stat-value" style="color:${pending>0?'var(--orange)':'var(--green)'}">${pending}</div><div class="stat-sub">от точек сбыта</div></div>
      <div class="stat-card"><div class="stat-label">Сырьё (мало)</div><div class="stat-value" style="color:${lowRaw>0?'var(--red)':'var(--green)'}">${lowRaw}</div><div class="stat-sub">позиций</div></div>
      <div class="stat-card"><div class="stat-label">Упаковка (мало)</div><div class="stat-value" style="color:${lowPkg>0?'var(--red)':'var(--green)'}">${lowPkg}</div><div class="stat-sub">позиций</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">📋 План на сегодня</div></div>
        ${planToday.length ? planToday.map(p=>{
          const prod=S.products.find(x=>x.id===p.productId);
          const pct=p.plan>0?Math.min(100,Math.round(p.done/p.plan*100)):0;
          return `<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-weight:700">${esc(prod?.name||'')}</span>
              <span style="font-family:var(--font-m);font-size:12px;color:${p.done>=p.plan?'var(--green)':'var(--orange)'}">${fmtN(p.done)} / ${fmtN(p.plan)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${p.done>=p.plan?'ok':''}" style="width:${pct}%"></div></div>
          </div>`;
        }).join('') : '<div class="empty-state" style="padding:30px"><div class="empty-icon" style="font-size:30px">📋</div><div>Нет плана на сегодня</div></div>'}
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">🎂 Последний выпуск</div></div>
        ${S.production.slice(-7).reverse().map(p=>{
          const prod=S.products.find(x=>x.id===p.productId);
          return `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px">
            <span style="font-weight:600">${esc(prod?.name||p.productId)}</span>
            <span style="color:var(--caramel);font-family:var(--font-m)">${fmtN(p.qty)} шт · ${fmtD(p.date)}</span>
          </div>`;
        }).join('') || '<div class="empty-state" style="padding:30px"><div class="empty-icon" style="font-size:30px">📦</div><div>Нет данных</div></div>'}
      </div>
    </div>`;
}

/* ── RAW ──────────────────────────────────────────────────────────────────── */
window.openRawModal = function(id=null) {
  $('mraw-title').textContent = id ? 'РЕДАКТИРОВАТЬ СЫРЬЁ' : 'НОВОЕ СЫРЬЁ';
  $('mraw-id').value = id||'';
  const it = id && S.raw.find(r=>r.id===id);
  $('mraw-name').value=$('mraw-type').value=$('mraw-desc').value='';
  $('mraw-qty').value=$('mraw-min').value='';
  if(it){ $('mraw-name').value=it.name||''; $('mraw-qty').value=it.qty??''; $('mraw-unit').value=it.unit||'кг'; $('mraw-type').value=it.type||''; $('mraw-min').value=it.min??''; $('mraw-desc').value=it.desc||''; }
  openModal('modal-raw'); $('mraw-name').focus();
};
window.saveRaw = async function() {
  const name=$('mraw-name').value.trim(); if(!name){toast('Введите название','err');return;}
  const p={name,qty:parseFloat($('mraw-qty').value)||0,unit:$('mraw-unit').value,type:$('mraw-type').value.trim(),min:parseFloat($('mraw-min').value)||0,desc:$('mraw-desc').value.trim()};
  const id=$('mraw-id').value; setLoad(true);
  try{
    if(id){const u=await API.raw.update(id,p);S.raw=S.raw.map(r=>r.id===id?u:r);toast('Обновлено ✓');}
    else{const c=await API.raw.create(p);S.raw.push(c);toast('Добавлено ✓');}
    closeModal('modal-raw');renderRaw();updateStats();
  }catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteRaw = async function(id){
  if(!confirm('Удалить?'))return; setLoad(true);
  try{await API.raw.remove(id);S.raw=S.raw.filter(r=>r.id!==id);renderRaw();updateStats();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
function renderRaw(q=''){
  const el=$('raw-cards'); let items=S.raw;
  if(q)items=items.filter(r=>r.name.toLowerCase().includes(q)||(r.type||'').toLowerCase().includes(q));
  if(!items.length){el.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🌾</div><div>${q?'Ничего не найдено':'Добавьте сырьё'}</div></div>`;return;}
  el.innerHTML=items.map(item=>{const low=item.min>0&&item.qty<=item.min;return `
    <div class="card ${low?'low-stock':''}">
      <div class="card-header"><div><div class="card-name">${esc(item.name)}</div>${item.type?`<div class="card-tag" style="margin-top:4px;color:var(--green);border-color:var(--green)">${esc(item.type)}</div>`:''}</div>${low?'<span class="low-badge">Мало</span>':''}</div>
      <div class="card-qty">${fmtN(item.qty)}</div><div class="card-unit">${item.unit}</div>
      ${item.desc?`<hr class="card-divider"><div class="card-desc">${esc(item.desc)}</div>`:''}
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openAdjust('${item.id}','raw')">✏️ Кол-во</button>
        <button class="btn btn-secondary btn-sm" onclick="openRawModal('${item.id}')">🔧</button>
        <button class="btn btn-danger" onclick="deleteRaw('${item.id}')">✕</button>
      </div></div>`;}).join('');
}

/* ── PKG ──────────────────────────────────────────────────────────────────── */
const PKG_ICONS={Пакет:'🛍️',Коробка:'📦',Контейнер:'🫙',Этикетка:'🏷️',Лента:'🎀',Плёнка:'📽️',Другое:'📋'};
window.openPkgModal = function(id=null){
  $('mpkg-title').textContent=id?'РЕДАКТИРОВАТЬ УПАКОВКУ':'НОВАЯ УПАКОВКА';
  $('mpkg-id').value=id||'';
  const it=id&&S.pkg.find(p=>p.id===id);
  $('mpkg-name').value=$('mpkg-desc').value=''; $('mpkg-qty').value=$('mpkg-min').value='';
  if(it){$('mpkg-name').value=it.name||'';$('mpkg-qty').value=it.qty??'';$('mpkg-unit').value=it.unit||'шт';$('mpkg-type').value=it.type||'Пакет';$('mpkg-min').value=it.min??'';$('mpkg-desc').value=it.desc||'';}
  openModal('modal-pkg');$('mpkg-name').focus();
};
window.savePkg = async function(){
  const name=$('mpkg-name').value.trim();if(!name){toast('Введите название','err');return;}
  const p={name,qty:parseFloat($('mpkg-qty').value)||0,unit:$('mpkg-unit').value,type:$('mpkg-type').value,min:parseFloat($('mpkg-min').value)||0,desc:$('mpkg-desc').value.trim()};
  const id=$('mpkg-id').value;setLoad(true);
  try{if(id){const u=await API.pkg.update(id,p);S.pkg=S.pkg.map(x=>x.id===id?u:x);toast('Обновлено ✓');}else{const c=await API.pkg.create(p);S.pkg.push(c);toast('Добавлено ✓');}closeModal('modal-pkg');renderPkg();updateStats();}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deletePkg = async function(id){
  if(!confirm('Удалить?'))return;setLoad(true);
  try{await API.pkg.remove(id);S.pkg=S.pkg.filter(p=>p.id!==id);renderPkg();updateStats();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
function renderPkg(q=''){
  const el=$('pkg-cards');let items=S.pkg;
  if(q)items=items.filter(p=>p.name.toLowerCase().includes(q)||p.type.toLowerCase().includes(q));
  if(!items.length){el.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><div>${q?'Ничего':'Добавьте упаковку'}</div></div>`;return;}
  el.innerHTML=items.map(item=>{const low=item.min>0&&item.qty<=item.min;const icon=PKG_ICONS[item.type]||'📋';return `
    <div class="card ${low?'low-stock':''}">
      <div class="card-header"><div><div class="card-name">${icon} ${esc(item.name)}</div><div class="card-tag" style="margin-top:4px;color:var(--blue);border-color:var(--blue)">${item.type}</div></div>${low?'<span class="low-badge">Мало</span>':''}</div>
      <div class="card-qty">${fmtN(item.qty)}</div><div class="card-unit">${item.unit}</div>
      ${item.desc?`<hr class="card-divider"><div class="card-desc">${esc(item.desc)}</div>`:''}
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openAdjust('${item.id}','pkg')">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="openPkgModal('${item.id}')">🔧</button>
        <button class="btn btn-danger" onclick="deletePkg('${item.id}')">✕</button>
      </div></div>`;}).join('');
}

/* ── ADJUST ───────────────────────────────────────────────────────────────── */
window.openAdjust = function(id,type){
  const data=type==='raw'?S.raw:S.pkg; const it=data.find(x=>x.id===id);if(!it)return;
  $('adj-id').value=id;$('adj-type').value=type;$('adj-label').textContent=`Количество (${it.unit})`;$('adj-qty').value=it.qty;
  openModal('modal-adjust');
};
window.adjDelta = d=>{const i=$('adj-qty');i.value=Math.max(0,(parseFloat(i.value)||0)+d);};
window.saveAdjust = async function(){
  const id=$('adj-id').value,type=$('adj-type').value,qty=parseFloat($('adj-qty').value)||0;setLoad(true);
  try{
    if(type==='raw'){const u=await API.raw.update(id,{qty});S.raw=S.raw.map(r=>r.id===id?{...r,...u}:r);renderRaw();}
    else{const u=await API.pkg.update(id,{qty});S.pkg=S.pkg.map(p=>p.id===id?{...p,...u}:p);renderPkg();}
    closeModal('modal-adjust');toast('Обновлено ✓');
  }catch(e){toast(e.message,'err');}finally{setLoad(false);}
};

/* ── PRODUCTS ─────────────────────────────────────────────────────────────── */
window.openProductModal = function(id=null){
  $('mprod-title').textContent=id?'РЕДАКТИРОВАТЬ':'НОВЫЙ ТОРТ';$('mprod-id').value=id||'';
  const it=id&&S.products.find(p=>p.id===id);
  ['mprod-name','mprod-cat','mprod-price','mprod-weight','mprod-shelf','mprod-desc','mprod-ingredients'].forEach(f=>$(f).value='');
  $('mprod-points').value='';
  if(it){$('mprod-name').value=it.name||'';$('mprod-cat').value=it.category||'';$('mprod-price').value=it.price??'';$('mprod-weight').value=it.weight??'';$('mprod-shelf').value=it.shelfDays??'';$('mprod-points').value=it.points||'';$('mprod-desc').value=it.desc||'';$('mprod-ingredients').value=it.ingredients||'';}
  openModal('modal-product');$('mprod-name').focus();
};
window.saveProduct = async function(){
  const name=$('mprod-name').value.trim();if(!name){toast('Введите название','err');return;}
  const p={name,category:$('mprod-cat').value.trim(),price:parseFloat($('mprod-price').value)||0,weight:parseFloat($('mprod-weight').value)||0,shelfDays:parseInt($('mprod-shelf').value)||0,points:$('mprod-points').value,desc:$('mprod-desc').value.trim(),ingredients:$('mprod-ingredients').value.trim()};
  const id=$('mprod-id').value;setLoad(true);
  try{if(id){const u=await API.products.update(id,p);S.products=S.products.map(x=>x.id===id?u:x);toast('Обновлено ✓');}else{const c=await API.products.create(p);S.products.push(c);toast('Добавлено ✓');}closeModal('modal-product');renderProducts();updateStats();}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteProduct = async function(id){
  if(!confirm('Удалить?'))return;setLoad(true);
  try{await API.products.remove(id);S.products=S.products.filter(p=>p.id!==id);renderProducts();updateStats();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
function renderProducts(q=''){
  const el=$('prod-cards');let items=S.products;
  if(q)items=items.filter(p=>p.name.toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q));
  if(!items.length){el.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎂</div><div>${q?'Ничего':'Добавьте первый торт'}</div></div>`;return;}
  el.innerHTML=items.map(it=>`
    <div class="card">
      <div class="card-header"><div><div class="card-name">🎂 ${esc(it.name)}</div>${it.category?`<div class="card-tag" style="margin-top:4px">${esc(it.category)}</div>`:''}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0">
        ${it.price?`<div><div class="stat-label" style="font-size:9px">Цена</div><div style="font-size:17px;font-weight:700;color:var(--caramel)">${fmtN(it.price)} ₽</div></div>`:''}
        ${it.weight?`<div><div class="stat-label" style="font-size:9px">Вес</div><div style="font-size:17px;font-weight:700;color:var(--brown)">${fmtN(it.weight)} кг</div></div>`:''}
        ${it.shelfDays?`<div><div class="stat-label" style="font-size:9px">Годен</div><div style="font-size:17px;font-weight:700;color:var(--blue)">${it.shelfDays} дн</div></div>`:''}
      </div>
      ${it.points?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${it.points.split(',').map(p=>`<span class="badge badge-blue" style="font-size:10px">${esc(p.trim())}</span>`).join('')}</div>`:''}
      ${it.ingredients?`<div class="card-desc" style="font-size:12px"><b>Состав:</b> ${esc(it.ingredients)}</div>`:''}
      ${it.desc?`<hr class="card-divider"><div class="card-desc">${esc(it.desc)}</div>`:''}
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openProductModal('${it.id}')">🔧 Изменить</button>
        <button class="btn btn-danger" onclick="deleteProduct('${it.id}')">✕</button>
      </div></div>`).join('');
}

/* ── PLAN ─────────────────────────────────────────────────────────────────── */
window.openPlanModal = function(id=null){
  $('mplan-id').value=id||'';
  const it=id&&S.plan.find(p=>p.id===id);
  $('mplan-date').value=it?.date||todayStr();
  $('mplan-product').innerHTML=S.products.map(p=>`<option value="${p.id}"${it?.productId===p.id?' selected':''}>${esc(p.name)}</option>`).join('');
  $('mplan-qty').value=it?.plan??'';$('mplan-note').value=it?.note||'';
  openModal('modal-plan');
};
window.savePlan = async function(){
  const productId=$('mplan-product').value,plan=parseFloat($('mplan-qty').value)||0;
  if(!productId||!plan){toast('Заполните поля','err');return;}
  const p={date:$('mplan-date').value,productId,plan,note:$('mplan-note').value.trim()};
  const id=$('mplan-id').value;setLoad(true);
  try{if(id){const u=await API.plan.update(id,p);S.plan=S.plan.map(x=>x.id===id?u:x);toast('Обновлено ✓');}else{const c=await API.plan.create(p);S.plan.push(c);toast('Добавлено ✓');}closeModal('modal-plan');renderPlan();}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deletePlan = async function(id){
  if(!confirm('Удалить?'))return;setLoad(true);
  try{await API.plan.remove(id);S.plan=S.plan.filter(p=>p.id!==id);renderPlan();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.openProductionModal = function(planId){
  const pl=S.plan.find(p=>p.id===planId);if(!pl)return;
  $('mpf-planid').value=planId;$('mpf-product').value=S.products.find(p=>p.id===pl.productId)?.name||pl.productId;
  $('mpf-date').value=pl.date;$('mpf-qty').value='';$('mpf-note').value='';
  openModal('modal-production');
};
window.saveProduction = async function(){
  const planId=$('mpf-planid').value;const pl=S.plan.find(p=>p.id===planId);if(!pl)return;
  const qty=parseFloat($('mpf-qty').value)||0;if(!qty){toast('Введите количество','err');return;}
  setLoad(true);
  try{const c=await API.production.create({planId,productId:pl.productId,date:pl.date,qty,note:$('mpf-note').value.trim()});S.production.push(c);closeModal('modal-production');renderPlan();toast('Факт записан ✓');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
function renderPlan(){
  const activeTab=document.querySelector('.tab.active')?.dataset?.tab||'all';
  const filterDate=$('plan-filter-date')?.value||'';
  let plans=[...S.plan].sort((a,b)=>b.date.localeCompare(a.date));
  if(filterDate)plans=plans.filter(p=>p.date===filterDate);
  if(activeTab==='today')plans=plans.filter(p=>p.date===todayStr());
  const el=$('plan-body');
  if(activeTab==='revision'){
    const grp={};
    plans.forEach(p=>{const prod=S.products.find(x=>x.id===p.productId);const n=prod?.name||p.productId;if(!grp[n])grp[n]={name:n,pl:0,dn:0};const done=S.production.filter(x=>x.productId===p.productId&&x.date===p.date).reduce((s,x)=>s+(parseFloat(x.qty)||0),0);grp[n].pl+=p.plan;grp[n].dn+=done;});
    const rows=Object.values(grp);
    el.innerHTML=rows.length?rows.map(g=>{const diff=g.dn-g.pl;const pct=g.pl>0?Math.min(100,Math.round(g.dn/g.pl*100)):0;return `<div class="plan-row">
      <div style="font-weight:700;color:var(--brown)">${esc(g.name)}</div><div>—</div>
      <div>${fmtN(g.pl)}</div><div style="font-weight:700;color:${diff>=0?'var(--green)':'var(--red)'}">${fmtN(g.dn)}</div>
      <div style="color:${diff>=0?'var(--green)':'var(--red)'}">${diff>=0?'+':''}${fmtN(diff)}</div>
      <div><div class="progress-bar" style="width:70px"><div class="progress-fill ${diff>=0?'ok':'over'}" style="width:${pct}%"></div></div><span style="font-size:11px;margin-left:4px">${pct}%</span></div>
      <div>—</div></div>`;}).join(''):`<div class="empty-state"><div class="empty-icon">📊</div><div>Нет данных</div></div>`;
    return;
  }
  el.innerHTML=plans.length?plans.map(p=>{
    const prod=S.products.find(x=>x.id===p.productId);
    const done=S.production.filter(x=>x.productId===p.productId&&x.date===p.date).reduce((s,x)=>s+(parseFloat(x.qty)||0),0);
    const pct=p.plan>0?Math.min(100,Math.round(done/p.plan*100)):0;const over=done>p.plan;
    return `<div class="plan-row">
      <div style="font-weight:700;color:var(--brown)">${esc(prod?.name||p.productId)}</div>
      <div style="font-family:var(--font-m);font-size:12px">${fmtD(p.date)}</div>
      <div>${fmtN(p.plan)}</div>
      <div style="font-weight:700;color:${over?'var(--red)':done>=p.plan?'var(--green)':'var(--orange)'}">${fmtN(done)}</div>
      <div>${fmtN(Math.max(0,p.plan-done))}</div>
      <div><div class="progress-bar" style="width:60px"><div class="progress-fill ${over?'over':done>=p.plan?'ok':''}" style="width:${pct}%"></div></div><span style="font-size:10px;margin-left:3px">${pct}%</span></div>
      <div style="display:flex;gap:5px">
        <button class="btn btn-caramel btn-xs" onclick="openProductionModal('${p.id}')">+ Факт</button>
        <button class="btn btn-secondary btn-xs" onclick="openPlanModal('${p.id}')">✏️</button>
        <button class="btn btn-danger" style="padding:3px 8px" onclick="deletePlan('${p.id}')">✕</button>
      </div></div>`;
  }).join(''):`<div class="empty-state"><div class="empty-icon">📊</div><div>Нет данных</div></div>`;
}

/* ── CALENDAR ─────────────────────────────────────────────────────────────── */
const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
$('cal-prev').onclick=()=>{S.calMonth--;if(S.calMonth<0){S.calMonth=11;S.calYear--;}renderCalendar();};
$('cal-next').onclick=()=>{S.calMonth++;if(S.calMonth>11){S.calMonth=0;S.calYear++;}renderCalendar();};
$('cal-today').onclick=()=>{const t=new Date();S.calYear=t.getFullYear();S.calMonth=t.getMonth();renderCalendar();};

function renderCalendar(){
  const {calYear:y,calMonth:m}=S;
  $('cal-month').textContent=`${MONTHS[m]} ${y}`;
  const evMap={};S.events.forEach(ev=>{if(!evMap[ev.date])evMap[ev.date]=[];evMap[ev.date].push(ev);});
  const td=new Date();let sdow=new Date(y,m,1).getDay();sdow=sdow===0?6:sdow-1;
  const dim=new Date(y,m+1,0).getDate();const dip=new Date(y,m,0).getDate();
  let html=DAYS.map(d=>`<div class="cal-dayname">${d}</div>`).join('');
  for(let i=0;i<sdow;i++)html+=`<div class="cal-cell other-month"><div class="cal-num">${dip-sdow+1+i}</div></div>`;
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=d===td.getDate()&&m===td.getMonth()&&y===td.getFullYear();
    const evs=evMap[ds]||[];
    const dots=evs.slice(0,3).map(ev=>`<div class="cal-dot ${ev.files?.length?'blue':''}">${esc(ev.op||'')}${ev.itemName?' · '+esc(ev.itemName):''}</div>`).join('');
    const more=evs.length>3?`<div class="cal-dot" style="background:var(--text3)">+${evs.length-3}</div>`:'';
    html+=`<div class="cal-cell ${isT?'today':''}" onclick="openEventModal('${ds}')"><div class="cal-num">${d}</div><div class="cal-dots">${dots}${more}</div></div>`;
  }
  const rem=(sdow+dim)%7===0?0:7-(sdow+dim)%7;
  for(let d=1;d<=rem;d++)html+=`<div class="cal-cell other-month"><div class="cal-num">${d}</div></div>`;
  $('cal-grid').innerHTML=html;
  renderEventsList();
}
window.openEventModal = function(date=null){
  $('mev-date').value=date||todayStr();$('mev-op').value='Приход';$('mev-cat').value='Сырьё';
  $('mev-qty').value='';$('mev-note').value='';$('mev-id').value='';$('mev-files-list').innerHTML='';
  const inp=$('mev-file-input');if(inp)inp._attachments=[];
  populateEvItems();openModal('modal-event');
};
$('mev-cat').addEventListener('change',populateEvItems);
$('mev-item').addEventListener('change',function(){
  const cat=$('mev-cat').value;const data=cat==='Сырьё'?S.raw:S.pkg;
  const it=data.find(x=>x.id===this.value);$('mev-unit').value=it?.unit||'';
});
function populateEvItems(){
  const cat=$('mev-cat').value;const data=cat==='Сырьё'?S.raw:S.pkg;
  $('mev-item').innerHTML=data.length?data.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''):'<option value="">— нет позиций —</option>';
  $('mev-item').dispatchEvent(new Event('change'));
}
$('mev-file-input').addEventListener('change', async function(){
  const file=this.files[0];if(!file)return;setLoad(true);
  try{
    const fd=new FormData();fd.append('file',file);
    const res=await API.uploadFile(fd);
    $('mev-files-list').innerHTML+=`<div class="file-item" id="fi-${res.filename}">
      <span class="file-icon">${fileIcon(res.original)}</span>
      <span class="file-name">${esc(res.original)}</span>
      <a class="file-dl" href="${res.url}" target="_blank">⬇</a>
      <button class="btn btn-danger" style="padding:2px 7px" onclick="removeAttach('${res.filename}')">✕</button></div>`;
    this._attachments=(this._attachments||[]);this._attachments.push({filename:res.filename,original:res.original,url:res.url});
    this.value='';toast('Файл прикреплён ✓');
  }catch(e){toast('Ошибка загрузки','err');}finally{setLoad(false);}
});
window.removeAttach = function(fn){
  const inp=$('mev-file-input');inp._attachments=(inp._attachments||[]).filter(a=>a.filename!==fn);
  document.getElementById('fi-'+fn)?.remove();
};
window.saveEvent = async function(){
  const date=$('mev-date').value,op=$('mev-op').value,cat=$('mev-cat').value,itemId=$('mev-item').value;
  const qty=parseFloat($('mev-qty').value)||0,unit=$('mev-unit').value,note=$('mev-note').value.trim();
  if(!date||!itemId){toast('Заполните поля','err');return;}
  const data=cat==='Сырьё'?S.raw:S.pkg;const it=data.find(x=>x.id===itemId);
  const inp=$('mev-file-input');const files=inp._attachments||[];
  setLoad(true);
  try{const c=await API.events.create({date,op,category:cat,itemId,itemName:it?.name||itemId,qty,unit,note,files});S.events.push(c);inp._attachments=[];closeModal('modal-event');renderCalendar();updateStats();toast('Запись добавлена ✓');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteEvent = async function(id){
  setLoad(true);try{await API.events.remove(id);S.events=S.events.filter(e=>e.id!==id);renderCalendar();updateStats();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.openEventDetail = function(id){
  const ev=S.events.find(e=>e.id===id);if(!ev)return;
  const OP={Приход:'📥',Расход:'📤',Инвентаризация:'📋',Списание:'🗑️'};
  $('ev-detail-body').innerHTML=`
    <div class="kv-row"><span class="kv-label">Дата</span><span class="kv-val">${fmtD(ev.date)}</span></div>
    <div class="kv-row"><span class="kv-label">Операция</span><span class="kv-val">${OP[ev.op]||''} ${esc(ev.op)}</span></div>
    <div class="kv-row"><span class="kv-label">Категория</span><span class="kv-val">${esc(ev.category)}</span></div>
    <div class="kv-row"><span class="kv-label">Позиция</span><span class="kv-val">${esc(ev.itemName)}</span></div>
    <div class="kv-row"><span class="kv-label">Количество</span><span class="kv-val">${fmtN(ev.qty)} ${ev.unit}</span></div>
    ${ev.note?`<div class="kv-row"><span class="kv-label">Примечание</span><span class="kv-val">${esc(ev.note)}</span></div>`:''}
    ${ev.createdBy?`<div class="kv-row"><span class="kv-label">Создал</span><span class="kv-val">${esc(ev.createdBy)}</span></div>`:''}
    ${ev.files?.length?`<div style="margin-top:14px"><div class="stat-label" style="font-size:9px;margin-bottom:7px">Документы</div>${ev.files.map(f=>`<div class="file-item"><span class="file-icon">${fileIcon(f.original)}</span><span class="file-name">${esc(f.original)}</span><a class="file-dl" href="${f.url}" download="${esc(f.original)}" title="Скачать">⬇️</a></div>`).join('')}</div>`:''}
    <div style="margin-top:16px;display:flex;justify-content:flex-end"><button class="btn btn-danger btn-sm" onclick="deleteEvent('${id}');closeModal('modal-ev-detail')">Удалить запись</button></div>`;
  openModal('modal-ev-detail');
};
function renderEventsList(){
  const el=$('events-list');const sorted=[...S.events].sort((a,b)=>b.date.localeCompare(a.date));
  $('events-count').textContent=sorted.length+' записей';
  const OP={Приход:'📥',Расход:'📤',Инвентаризация:'📋',Списание:'🗑️'};
  el.innerHTML=sorted.length?sorted.map(ev=>`
    <div class="event-row" onclick="openEventDetail('${ev.id}')">
      <div class="event-date">${fmtD(ev.date)}</div>
      <div class="event-name">${OP[ev.op]||''} ${esc(ev.itemName)}</div>
      <div class="event-qty">${ev.op==='Расход'||ev.op==='Списание'?'−':'+'}${fmtN(ev.qty)} ${ev.unit}</div>
      ${ev.files?.length?`<span title="${ev.files.length} файлов">📎</span>`:'<span style="width:18px"></span>'}
    </div>`).join(''):`<div class="empty-state"><div class="empty-icon">📋</div><div>Нет записей</div></div>`;
}

/* ── REQUESTS ─────────────────────────────────────────────────────────────── */
window.openRequestModal = function(){
  $('mreq-point').value='Магазин';$('mreq-date').value=todayStr();$('mreq-note').value='';
  $('mreq-items').innerHTML='';addReqItem();
  openModal('modal-request');
};
window.addReqItem = function(){
  const id='ri-'+genId();
  const opts=S.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const row=document.createElement('div');
  row.id=id;row.style.cssText='display:flex;gap:7px;margin-bottom:7px;align-items:center';
  row.innerHTML=`<select style="flex:2">${opts||'<option>— нет продуктов —</option>'}</select><input type="number" min="1" placeholder="Кол-во" style="flex:1"><button class="btn btn-danger" style="padding:5px 9px" onclick="document.getElementById('${id}').remove()">✕</button>`;
  $('mreq-items').appendChild(row);
};
window.saveRequest = async function(){
  const point=$('mreq-point').value,date=$('mreq-date').value,note=$('mreq-note').value.trim();
  const rows=[...$('mreq-items').children];
  const items=rows.map(r=>{const sel=r.querySelector('select'),inp=r.querySelector('input[type=number]');const prod=S.products.find(p=>p.id===sel?.value);return{productId:sel?.value,name:prod?.name||sel?.value,qty:parseFloat(inp?.value)||0};}).filter(i=>i.qty>0);
  if(!items.length){toast('Добавьте позиции','err');return;}
  setLoad(true);
  try{const c=await API.requests.create({fromPoint:point,date,note,items,status:'new'});S.requests.push(c);closeModal('modal-request');renderRequests();updateStats();toast('Заявка отправлена ✓');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.updReqStatus = async function(id,status){
  setLoad(true);try{const u=await API.requests.update(id,{status});S.requests=S.requests.map(r=>r.id===id?{...r,...u}:r);renderRequests();updateStats();toast('Статус обновлён ✓');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteRequest = async function(id){
  if(!confirm('Удалить заявку?'))return;setLoad(true);
  try{await API.requests.remove(id);S.requests=S.requests.filter(r=>r.id!==id);renderRequests();updateStats();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
function renderRequests(){
  const el=$('req-content');
  const SL={new:'badge-orange',process:'badge-blue',done:'badge-green',cancel:'badge-gray'};
  const ST={new:'Новая',process:'В работе',done:'Выполнена',cancel:'Отменена'};
  const userPages=S.pages;
  const isAdmin=userPages.includes('rbac');
  const sorted=[...S.requests].sort((a,b)=>(b.created||'').localeCompare(a.created||''));
  if(!sorted.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📬</div><div>Нет заявок</div></div>`;return;}
  el.innerHTML=sorted.map(r=>`
    <div class="req-card">
      <div class="req-header">
        <div>
          <div style="font-size:10px;font-family:var(--font-m);color:var(--text3)">#${(r.id||'').slice(-6).toUpperCase()}</div>
          <div style="font-weight:700;font-size:15px;margin-top:2px">📍 ${esc(r.fromPoint)} → Цех</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${fmtD(r.date)} · ${esc(r.createdBy||'')}</div>
        </div>
        <span class="badge ${SL[r.status]||'badge-gray'}">${ST[r.status]||r.status}</span>
      </div>
      <div class="req-items">${(r.items||[]).map(i=>`<div class="req-item-row"><span>${esc(i.name)}</span><span style="font-weight:700">${fmtN(i.qty)} шт</span></div>`).join('')}</div>
      ${r.note?`<div style="font-size:11px;color:var(--text2);margin-top:6px">💬 ${esc(r.note)}</div>`:''}
      <div style="display:flex;gap:7px;margin-top:11px;flex-wrap:wrap">
        ${r.status==='new'?`<button class="btn btn-caramel btn-sm" onclick="updReqStatus('${r.id}','process')">▶ В работу</button>`:''}
        ${r.status==='process'?`<button class="btn btn-success btn-sm" onclick="updReqStatus('${r.id}','done')">✓ Выполнена</button>`:''}
        ${r.status!=='cancel'&&r.status!=='done'?`<button class="btn btn-secondary btn-sm" onclick="updReqStatus('${r.id}','cancel')">✕ Отменить</button>`:''}
        ${isAdmin?`<button class="btn btn-danger" onclick="deleteRequest('${r.id}')">🗑</button>`:''}
      </div></div>`).join('');
}

/* ── RBAC ─────────────────────────────────────────────────────────────────── */
const PAGE_LABELS = {
  dashboard:'🏠 Главная', raw:'🌾 Сырьё', pkg:'📦 Упаковка',
  products:'🎂 Продукция', plan:'📊 План', calendar:'📅 Календарь',
  requests:'📬 Заявки', rbac:'🔐 Роли и пользователи',
};
const ALL_PAGES = ['dashboard','raw','pkg','products','plan','calendar','requests','rbac'];

function renderRBAC(){
  renderRolesPanel();
  renderUsersPanel();
}

function renderRolesPanel(){
  const el=$('roles-list');
  el.innerHTML=S.roles.map(role=>`
    <div class="role-card-item">
      <div>
        <div class="role-name">${esc(role.name)}</div>
        <div class="role-pages">${(role.pages||[]).map(p=>`<span class="role-page-tag">${PAGE_LABELS[p]||p}</span>`).join('')}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-xs" onclick="openRoleModal('${role.id}')">✏️ Изменить</button>
        <button class="btn btn-danger" onclick="deleteRole('${role.id}')">✕</button>
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:24px"><div>Нет ролей</div></div>';
}

function renderUsersPanel(){
  const el=$('users-table-body');
  el.innerHTML=S.users.map(u=>{
    const role=S.roles.find(r=>r.id===u.roleId);
    return `<tr>
      <td style="font-family:var(--font-m);font-weight:600">${esc(u.username)}</td>
      <td>${esc(u.name)}</td>
      <td>${role?`<span class="badge badge-purple">${esc(role.name)}</span>`:`<span class="badge badge-gray">${esc(u.roleId)}</span>`}</td>
      <td>${(role?.pages||[]).map(p=>`<span class="role-page-tag">${PAGE_LABELS[p]||p}</span>`).join(' ')}</td>
      <td style="font-size:11px;color:var(--text3)">${fmtD(u.created?.slice(0,10)||'')}</td>
      <td>
        <div class="user-row-actions">
          <button class="btn btn-secondary btn-xs" onclick="openUserModal('${u.id}')">✏️ Изменить</button>
          <button class="btn btn-danger" onclick="deleteUser('${u.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Нет пользователей</td></tr>';
}

// Role modal
window.openRoleModal = function(id=null){
  $('mrole-id').value=id||'';
  const it=id&&S.roles.find(r=>r.id===id);
  $('mrole-name').value=it?.name||'';
  // render permission chips
  const container=$('mrole-perms');
  const active=it?.pages||[];
  container.innerHTML=ALL_PAGES.map(p=>`
    <label class="perm-chip ${active.includes(p)?'on':''}" id="chip-${p}">
      <input type="checkbox" value="${p}" ${active.includes(p)?'checked':''} onchange="toggleChip(this)">
      ${PAGE_LABELS[p]||p}
    </label>`).join('');
  openModal('modal-role');$('mrole-name').focus();
};
window.toggleChip = function(cb){
  cb.closest('.perm-chip').classList.toggle('on',cb.checked);
};
window.saveRole = async function(){
  const name=$('mrole-name').value.trim();if(!name){toast('Введите название роли','err');return;}
  const pages=[...$('mrole-perms').querySelectorAll('input:checked')].map(c=>c.value);
  const id=$('mrole-id').value;setLoad(true);
  try{
    if(id){const u=await API.roles.update(id,{name,pages});S.roles=S.roles.map(r=>r.id===id?u:r);toast('Роль обновлена ✓');}
    else{const c=await API.roles.create({name,pages});S.roles.push(c);toast('Роль создана ✓');}
    closeModal('modal-role');renderRBAC();
  }catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteRole = async function(id){
  if(!confirm('Удалить роль? Пользователи с этой ролью потеряют доступ.'))return;setLoad(true);
  try{await API.roles.remove(id);S.roles=S.roles.filter(r=>r.id!==id);renderRBAC();toast('Роль удалена');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};

// User modal
window.openUserModal = function(id=null){
  $('muser-id').value=id||'';
  const it=id&&S.users.find(u=>u.id===id);
  $('muser-uname').value=it?.username||'';
  $('muser-name').value=it?.name||'';
  $('muser-pwd').value='';
  $('muser-pwd').placeholder=id?'Оставьте пустым, чтобы не менять':'Введите пароль';
  // populate roles select
  $('muser-role').innerHTML=S.roles.map(r=>`<option value="${r.id}"${it?.roleId===r.id?' selected':''}>${esc(r.name)}</option>`).join('');
  // show pages preview
  updateUserRolePreview();
  openModal('modal-user');$('muser-uname').focus();
};
$('muser-role')?.addEventListener('change',updateUserRolePreview);
function updateUserRolePreview(){
  const roleId=$('muser-role').value;
  const role=S.roles.find(r=>r.id===roleId);
  $('muser-pages-preview').innerHTML=role?(role.pages||[]).map(p=>`<span class="role-page-tag">${PAGE_LABELS[p]||p}</span>`).join(' '):'<span style="color:var(--text3)">Выберите роль</span>';
}
window.saveUser = async function(){
  const id=$('muser-id').value;
  const username=$('muser-uname').value.trim();
  const name=$('muser-name').value.trim();
  const password=$('muser-pwd').value;
  const roleId=$('muser-role').value;
  if(!username||!name||!roleId){toast('Заполните поля','err');return;}
  if(!id&&!password){toast('Введите пароль','err');return;}
  const payload={username,name,roleId};if(password)payload.password=password;
  setLoad(true);
  try{
    if(id){const u=await API.users.update(id,payload);S.users=S.users.map(x=>x.id===id?{...x,...u}:x);toast('Пользователь обновлён ✓');}
    else{const c=await API.users.create(payload);S.users.push(c);toast('Пользователь создан ✓');}
    closeModal('modal-user');renderUsersPanel();
  }catch(e){toast(e.message,'err');}finally{setLoad(false);}
};
window.deleteUser = async function(id){
  if(id===S.me?.userId){toast('Нельзя удалить себя','err');return;}
  if(!confirm('Удалить пользователя?'))return;setLoad(true);
  try{await API.users.remove(id);S.users=S.users.filter(u=>u.id!==id);renderUsersPanel();toast('Удалено');}catch(e){toast(e.message,'err');}finally{setLoad(false);}
};

/* ── STATS sidebar ────────────────────────────────────────────────────────── */
function updateStats(){
  $('stat-raw').textContent    = S.raw.length;
  $('stat-pkg').textContent    = S.pkg.length;
  $('stat-prod').textContent   = S.products.length;
  const pend=S.requests.filter(r=>r.status==='new').length;
  $('stat-req').textContent    = pend;
  const badge=$('nav-req-badge');
  if(badge){badge.textContent=pend;badge.style.display=pend?'':'none';}
}

/* ── INIT ─────────────────────────────────────────────────────────────────── */
async function safeLoad(fn){try{return await fn();}catch(e){console.warn('skip:',e.message);return [];}}

async function init(){
  setLoad(true);
  try{
    // PocketBase: если нет валидной сессии — на логин
    const me = await API.me();
    if(!me){ location.href='login.html'; return; }
    S.me = me;
    S.pages = S.me.pages || [];
    $('sb-uname').textContent = S.me.name;

    S.roles = await safeLoad(()=>API.roles.list());
    $('sb-urole').textContent = S.me.roleName || S.roles.find(r=>r.id===S.me.roleId)?.name || '';

    buildNav();

    const [raw,pkg,events,products,plan,production,requests] = await Promise.all([
      safeLoad(()=>API.raw.list()),
      safeLoad(()=>API.pkg.list()),
      safeLoad(()=>API.events.list()),
      safeLoad(()=>API.products.list()),
      safeLoad(()=>API.plan.list()),
      safeLoad(()=>API.production.list()),
      safeLoad(()=>API.requests.list()),
    ]);
    S.raw=raw; S.pkg=pkg; S.events=events; S.products=products;
    S.plan=plan; S.production=production; S.requests=requests;

    if(S.pages.includes('rbac')) S.users = await safeLoad(()=>API.users.list());

    renderRaw(); renderPkg(); renderProducts(); updateStats();
    navigateTo(S.pages[0]||'dashboard');
  }catch(e){
    console.error('init:', e);
    toast('Ошибка загрузки: '+e.message,'err');
  }finally{setLoad(false);}
}

$('logout-btn').addEventListener('click', async()=>{ await API.logout(); location.href='login.html'; });

// Plan tabs
document.querySelectorAll('.tab[data-tab]').forEach(t=>t.addEventListener('click',function(){
  document.querySelectorAll('.tab[data-tab]').forEach(x=>x.classList.remove('active'));
  this.classList.add('active');renderPlan();
}));

init();
