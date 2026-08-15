// ============================================================
// auth.js — Deck Of Deception authentication + player profile
// Supports Anonymous + Google Sign-In, PUBG-style ranks & avatars.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDNr3tNvKHswj5a98P6c6s33r6-GVQ2pUQ",
  authDomain: "deckofdeception-ee478.firebaseapp.com",
  projectId: "deckofdeception-ee478",
  storageBucket: "deckofdeception-ee478.firebasestorage.app",
  messagingSenderId: "238749670387",
  appId: "1:238749670387:web:685e9f2232f0318fdc1086",
  measurementId: "G-N2N3V1XG6R"
};

firebase.initializeApp(firebaseConfig);
const dodAuth = firebase.auth();
const dodDb = firebase.firestore();

let _dodProfile = null;          
let _dodProfileReadyCallbacks = [];

function dodOnProfileReady(cb){
  if(_dodProfile){ cb(_dodProfile); }
  else { _dodProfileReadyCallbacks.push(cb); }
}
function _dodFireReady(){
  // Wait for the 2.5 second intro animation to finish before proceeding
  if (typeof window !== 'undefined' && window.minimumBootTimePassed === false) {
     setTimeout(_dodFireReady, 100);
     return;
  }
  
  dodHideBootstrap(); // Returning player detected! Hide loader and go straight to game.
  _dodProfileReadyCallbacks.forEach(cb=>cb(_dodProfile));
  _dodProfileReadyCallbacks = [];
}

function _dodReadLocalLegacyProgress(){
  let currency = 100, ownedSkins = [];
  try{
    const c = localStorage.getItem('dod_currency_v1');
    if(c!==null) currency = JSON.parse(c);
    const o = localStorage.getItem('dod_owned_shop_skins_v1');
    if(o!==null) ownedSkins = JSON.parse(o);
  }catch(e){}
  return { currency, ownedSkins };
}

dodAuth.onAuthStateChanged(function(user){
  if(!user){
    // If no user, show login/signup choice modal instead of forcing anonymous instantly
    dodShowLoginModal();
    return;
  }
  const uid = user.uid;
  const ref = dodDb.collection('users').doc(uid);
  ref.get().then(function(doc){
    if(doc.exists){
      _dodProfile = Object.assign({ uid: uid }, doc.data());
      if(_dodProfile.displayName){
        dodHideLoginModal();
        _dodFireReady();
      } else {
        dodShowNamePrompt();
      }
    } else {
      const legacy = _dodReadLocalLegacyProgress();
      const newProfile = {
        displayName: null, // Always force the Name Setup prompt for new players!
        currency: legacy.currency,
        ownedSkins: legacy.ownedSkins,
        // PUBG Profile & Progression Defaults
        level: 1,
        points: 0,
        tier: 'Bronze V',
        avatar: 'default_avatar',
        frame: 'default_frame',
        unlockedAvatars: ['default_avatar'],
        unlockedFrames: ['default_frame'],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      ref.set(newProfile).then(function(){
        _dodProfile = Object.assign({ uid: uid }, newProfile);
        if(!_dodProfile.displayName){
          dodShowNamePrompt();
        } else {
          dodHideLoginModal();
          _dodFireReady();
        }
      });
    }
  }).catch(function(err){
    console.error('Profile load failed:', err);
  });
});

function dodSignInWithGoogle(){
  const provider = new firebase.auth.GoogleAuthProvider();
  dodAuth.signInWithPopup(provider).catch(function(error){
    console.error("Google Sign-In Error:", error);
  });
}

function dodSignInAnonymously(){
  dodAuth.signInAnonymously().catch(function(err){
    console.error('Anonymous sign-in failed:', err);
  });
}

// Function to clear the 3D Bootstrap Scene once Firebase connects
function dodHideBootstrap(){
  const boot = document.getElementById('bootstrapOverlay');
  if(boot) {
    boot.style.opacity = '0';
    setTimeout(() => { boot.style.display = 'none'; }, 800);
  }
}

function dodShowLoginModal(){
  // Wait for the 2.5 second intro animation to finish before showing login
  if (typeof window !== 'undefined' && window.minimumBootTimePassed === false) {
     setTimeout(dodShowLoginModal, 100);
     return;
  }
  
  dodHideBootstrap(); // Show login only AFTER hiding the loading screen
  const overlay = document.getElementById('loginChoiceOverlay');
  if(overlay) overlay.classList.add('show');
}
function dodHideLoginModal(){
  const overlay = document.getElementById('loginChoiceOverlay');
  if(overlay) overlay.classList.remove('show');
}

function dodShowNamePrompt(){
  dodHideLoginModal();
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
      dodHideLoginModal();
      _dodFireReady();
    })
    .catch(function(err){ console.error('Name save failed:', err); });
}

// PUBG Progression Sync (Points, Levels, Tiers)
function dodAddGamePoints(earnedPoints){
  if(!_dodProfile) return;
  _dodProfile.points = (_dodProfile.points || 0) + earnedPoints;
  
  // Level threshold: 60 points per level
  while(_dodProfile.points >= 60){
    _dodProfile.points -= 60;
    _dodProfile.level = (_dodProfile.level || 1) + 1;
    checkTierAndUpgrades(); // was: checkTierAndUnlocks (typo — function is named checkTierAndUpgrades)
  }

  dodDb.collection('users').doc(_dodProfile.uid).update({
    points: _dodProfile.points,
    level: _dodProfile.level,
    tier: _dodProfile.tier,
    unlockedAvatars: _dodProfile.unlockedAvatars,
    unlockedFrames: _dodProfile.unlockedFrames
  }).catch(e=>console.error("Failed to sync progression:", e));
}

function checkTierAndUpgrades(newAvatar, newFrame){
  if(!_dodProfile) return;
  const lvl = _dodProfile.level;
  
  // PUBG Tier Logic based on Level
  if(lvl >= 50) _dodProfile.tier = 'Conqueror';
  else if(lvl >= 40) _dodProfile.tier = 'Ace';
  else if(lvl >= 30) _dodProfile.tier = 'Crown';
  else if(lvl >= 20) _dodProfile.tier = 'Diamond';
  else if(lvl >= 10) _dodProfile.tier = 'Platinum';
  else _dodProfile.tier = 'Bronze';
}

function dodSyncCurrencyToProfile(newAmount){
  if(!_dodProfile) return;
  _dodProfile.currency = newAmount;
  dodDb.collection('users').doc(_dodProfile.uid).update({ currency: newAmount }).catch(function(){});
}

window.DoDAuth = {
  onProfileReady: dodOnProfileReady,
  getProfile: function(){ return _dodProfile; },
  submitName: dodSubmitName,
  signInWithGoogle: dodSignInWithGoogle,
  signInAnonymously: dodSignInAnonymously,
  addGamePoints: dodAddGamePoints,
  syncCurrency: dodSyncCurrencyToProfile
};
