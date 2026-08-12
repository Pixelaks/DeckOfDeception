// ============================================================
// shop.js — Deck Of Deception in-game shop
// ------------------------------------------------------------
// Must be loaded AFTER the main game script (it relies on the
// shared top-level `SKINS`, `menuState`, and `buildMenu` from
// deck-of-deception.html, and this file must live in the same
// folder as that HTML file — it's a relative <script src>.
//
// Persistence: uses localStorage on the player's own device.
// This is appropriate here because this is a standalone file
// you run yourself, not a sandboxed preview.
//
// Honest scope note: this is a LOCAL, in-session economy only.
// There is no server, no accounts, no real payments. If real
// money purchases are ever wanted, that needs a backend before
// anything else — this file is not that.
// ============================================================

const DOD_CURRENCY_KEY = 'dod_currency_v1';
const DOD_OWNED_KEY = 'dod_owned_shop_skins_v1';

const SHOP_LOCKED_CATALOG = [
  { id:'obsidian', name:'Obsidian',      color:'#3a3a3a', price:150 },
  { id:'rose',     name:'Rose Quartz',   color:'#c97a9a', price:180 },
  { id:'storm',    name:'Storm Grey',    color:'#6b7a8a', price:160 },
  { id:'venom',    name:'Venom',         color:'#7ac927', price:220 },
  { id:'midnight', name:'Midnight Blue', color:'#27407a', price:240 },
  { id:'royal',    name:'Royal Purple',  color:'#7a279a', price:300 },
];

function dodSafeGet(key, fallback){
  try{ const v = localStorage.getItem(key); return v===null ? fallback : JSON.parse(v); }
  catch(e){ return fallback; }
}
function dodSafeSet(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ /* storage unavailable (e.g. private browsing) — fail quietly */ }
}

function dodGetCurrency(){ return dodSafeGet(DOD_CURRENCY_KEY, 100); }
function dodSetCurrency(v){ dodSafeSet(DOD_CURRENCY_KEY, Math.max(0, Math.round(v))); }
function dodAddCurrency(amount){ dodSetCurrency(dodGetCurrency() + amount); }

function dodGetOwned(){ return dodSafeGet(DOD_OWNED_KEY, []); }
function dodMarkOwned(id){
  const owned = dodGetOwned();
  if(!owned.includes(id)){ owned.push(id); dodSafeSet(DOD_OWNED_KEY, owned); }
}

// Re-add any previously purchased skins into the shared SKINS array (used by
// the Play Setup picker) on load, so a returning player sees what they own.
function dodRestoreOwnedSkins(){
  if(typeof SKINS === 'undefined') return;
  const owned = dodGetOwned();
  SHOP_LOCKED_CATALOG.forEach(item=>{
    if(owned.includes(item.id) && !SKINS.some(s=>s.name===item.name)){
      SKINS.push({ name:item.name, color:item.color });
    }
  });
}
dodRestoreOwnedSkins();

function dodBuySkin(id){
  const item = SHOP_LOCKED_CATALOG.find(s=>s.id===id);
  if(!item) return false;
  const owned = dodGetOwned();
  if(owned.includes(id)) return true;
  const bal = dodGetCurrency();
  if(bal < item.price) return false;
  dodSetCurrency(bal - item.price);
  dodMarkOwned(id);
  if(typeof SKINS!=='undefined' && !SKINS.some(s=>s.name===item.name)){
    SKINS.push({ name:item.name, color:item.color });
  }
  return true;
}

function dodPurchaseFlow(id){
  const ok = dodBuySkin(id);
  if(ok){
    if(typeof buildMenu==='function') buildMenu();
    dodRenderShop();
  }
}

function dodEquip(id){
  const item = SHOP_LOCKED_CATALOG.find(s=>s.id===id);
  if(!item || typeof SKINS==='undefined') return;
  const idx = SKINS.findIndex(s=>s.name===item.name);
  if(idx>=0 && typeof menuState!=='undefined'){
    menuState.skinIdx = idx;
    if(typeof buildMenu==='function') buildMenu();
    dodRenderShop();
  }
}

function dodRenderShop(){
  const root = document.getElementById('shopRoot');
  const bal = dodGetCurrency();
  ['shopCurrency','hubCurrency'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = bal;
  });
  if(!root) return;
  const owned = dodGetOwned();
  let html = '';

  if(typeof SKINS!=='undefined'){
    SKINS.slice(0,4).forEach((s,i)=>{
      const equipped = (typeof menuState!=='undefined' && menuState.skinIdx===i);
      html += `<div class="shop-item">
        <div class="shop-swatch" style="background:${s.color}"></div>
        <div class="shop-name">${s.name}</div>
        <div class="shop-price">Included</div>
        <button class="${equipped?'equipped':'owned'}" disabled>${equipped?'Equipped':'Owned'}</button>
      </div>`;
    });
  }

  SHOP_LOCKED_CATALOG.forEach(item=>{
    const isOwned = owned.includes(item.id);
    const skinIdx = typeof SKINS!=='undefined' ? SKINS.findIndex(s=>s.name===item.name) : -1;
    const equipped = isOwned && skinIdx>=0 && typeof menuState!=='undefined' && menuState.skinIdx===skinIdx;
    let btnHtml;
    if(equipped){
      btnHtml = `<button class="equipped" disabled>Equipped</button>`;
    } else if(isOwned){
      btnHtml = `<button class="owned" onclick="dodEquip('${item.id}')">Equip</button>`;
    } else {
      const affordable = bal >= item.price;
      btnHtml = `<button class="locked" ${affordable?'':'disabled'} onclick="dodPurchaseFlow('${item.id}')">Buy — ${item.price}c</button>`;
    }
    html += `<div class="shop-item">
      <div class="shop-swatch" style="background:${item.color}"></div>
      <div class="shop-name">${item.name}</div>
      <div class="shop-price">${isOwned?'Owned':item.price+' coins'}</div>
      ${btnHtml}
    </div>`;
  });

  root.innerHTML = html;
}

window.DoDShop = {
  getCurrency: dodGetCurrency,
  addCurrency: dodAddCurrency,
  render: dodRenderShop,
};
