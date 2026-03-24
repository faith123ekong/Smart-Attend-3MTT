import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ai-studio-applet-webapp-4c980.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-4c980",
  storageBucket: "ai-studio-applet-webapp-4c980.firebasestorage.app", // Added
  messagingSenderId: "972671343191", // Added
  appId: "1:972671343191:web:6b03e235da4304708b2112"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
