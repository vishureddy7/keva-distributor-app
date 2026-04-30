// ─────────────────────────────────────────────
//  firebase.js
//  Firebase app initialisation — single instance
// ─────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyCaKePHdiSVmHE9s66h19Y13_t5uiS8adw",
  authDomain:        "keva-distributor.firebaseapp.com",
  projectId:         "keva-distributor",
  storageBucket:     "keva-distributor.firebasestorage.app",
  messagingSenderId: "567100181976",
  appId:             "1:567100181976:web:24a6ba9ab209455686b6ad",
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
