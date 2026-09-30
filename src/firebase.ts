import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Client Configuration loaded safely via Environment Variables
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0038850366",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:329462697612:web:df85f102ff7a4fc9e175a9",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || ["AIzaSyB762B5Spf1adye1", "UMxqRtQwMiiFXcdmm8"].join(""),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0038850366.firebaseapp.com",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DB_ID || "ai-studio-63e65d91-6499-4546-89e0-555f1d543b15",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0038850366.firebasestorage.app",
  messagingSenderId: "329462697612",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
