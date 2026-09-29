import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Client Configuration
const firebaseConfig = {
  projectId: "gen-lang-client-0038850366",
  appId: "1:329462697612:web:df85f102ff7a4fc9e175a9",
  apiKey: "AIzaSyB762B5Spf1adye1UMxqRtQwMiiFXcdmm8",
  authDomain: "gen-lang-client-0038850366.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-63e65d91-6499-4546-89e0-555f1d543b15",
  storageBucket: "gen-lang-client-0038850366.firebasestorage.app",
  messagingSenderId: "329462697612",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
