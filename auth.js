// ============================================================
// auth.js — Deck Of Deception authentication + player profile
// ------------------------------------------------------------
// Load order matters:
//   1. Firebase SDK <script> tags (app, auth, firestore)
//   2. auth.js  (this file)
//   3. deck-of-deception.html's own inline <script>
//   4. shop.js
//
// PUBG-style flow: no signup form. We sign the player in
// anonymously the instant the page loads (invisible to them),
// then — only if they've never set one before — prompt for a
// display name. That name + a generated UID is their identity
// from then on, persisted in Firestore under /users/{uid}.
// ============================================================

// ---- PASTE YOUR FIREBASE CONFIG HERE ----
const firebaseConfig = {
  apiKey: "AIzaSyDNr3tNvKHswj5a98P6c6s33r6-GVQ2pUQ",
  authDomain: "deckofdeception-ee478.firebaseapp.com",
  projectId: "deckofdeception-ee478",
  storageBucket: "deckofdeception-ee478.firebasestorage.app",
  messagingSenderId: "238749670387",
  appId: "1:238749670387:web:685e9f2232f0318fdc1086",
  measurementId: "G-N2N3V1XG6R"
};
// ------------------------------------------

firebase.initializeApp(firebaseConfig);
const dodAuth = firebase.auth();
const dodDb = firebase.firestore();

let _dodProfile = null;          // { uid, displayName, currency, ownedSkins, createdAt }
let _dodProfileReadyCallbacks = [];

function dodOnProfileReady(cb){
  if(_dodProfile){ cb(_dodProfile); }
  else { _dodProfileReadyCallbacks.push(cb); }
}
function _dodFireReady(){
  _dodProfileReadyCallbacks.forEach(cb=>cb(_dodProfile));
  _dodProfileReadyCallbacks = [];
}

// One-time migration: if this browser already has local shop.js
// progress (currency/owned skins from before accounts existed),
// carry it into the new Firestore profile instead of resetting
// the player to zero the first time they get a real account.
function _dodReadLocalLegacyProgress(){
  let currency = 100, ownedSkins = [];
  try{
    const c = localStorage.getItem('dod_currency_v1');
    if(c!==null) currency = JSON.parse(c);
    const o = localStorage.getItem('dod_owned_shop_skins_v1');
    if(o!==null) ownedSkins = JSON.parse(o);
  }catch(e){ /* ignore, use defaults */ }
  return { currency, ownedSkins };
}

dodAuth.onAuthStateChanged(function(user){
  if(!user){
    dodAuth.signInAnonymously().catch(function(err){
      console.error('Anonymous sign-in failed:', err);
    });
    return;
  }
  const uid = user.uid;
  const ref = dodDb.collection('users').doc(uid);
  ref.get().then(function(doc){
    if(doc.exists){
      _dodProfile = Object.assign({ uid: uid }, doc.data());
      if(_dodProfile.displayName){
        _dodFireReady();
      } else {
        dodShowNamePrompt();
      }
    } else {
      const legacy = _dodReadLocalLegacyProgress();
      const newProfile = {
        displayName: null,
        currency: legacy.currency,
        ownedSkins: legacy.ownedSkins,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      ref.set(newProfile).then(function(){
        _dodProfile = Object.assign({ uid: uid }, newProfile);
        dodShowNamePrompt();
      });
    }
  }).catch(function(err){
    console.error('Profile load failed:', err);
  });
});

function dodShowNamePrompt(){
  const overlay = document.getElementById('nameSetupOverlay');
  if(overlay) overlay.classList.add('show');
}

function dodSubmitName(){
  const input = document.getElementById('nameSetupInput');
  const name = (input.value || '').trim().slice(0, 18);
  if(name.length < 2){
    input.style.borderColor = 'var(--danger-bright)';
    return;
  }
  dodDb.collection('users').doc(_dodProfile.uid).update({ displayName: name })
    .then(function(){
      _dodProfile.displayName = name;
      const overlay = document.getElementById('nameSetupOverlay');
      if(overlay) overlay.classList.remove('show');
      _dodFireReady();
    })
    .catch(function(err){ console.error('Name save failed:', err); });
}

// Called by shop.js / main game once currency changes, so the
// authoritative copy lives in Firestore, not just localStorage.
function dodSyncCurrencyToProfile(newAmount){
  if(!_dodProfile) return;
  _dodProfile.currency = newAmount;
  dodDb.collection('users').doc(_dodProfile.uid).update({ currency: newAmount }).catch(function(){});
}
function dodSyncOwnedSkinsToProfile(ownedSkinsArray){
  if(!_dodProfile) return;
  _dodProfile.ownedSkins = ownedSkinsArray;
  dodDb.collection('users').doc(_dodProfile.uid).update({ ownedSkins: ownedSkinsArray }).catch(function(){});
}

window.DoDAuth = {
  onProfileReady: dodOnProfileReady,
  getProfile: function(){ return _dodProfile; },
  submitName: dodSubmitName,
  syncCurrency: dodSyncCurrencyToProfile,
  syncOwnedSkins: dodSyncOwnedSkinsToProfile
};
