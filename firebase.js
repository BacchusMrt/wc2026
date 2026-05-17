import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBo3-V9jsQHbr0O2KprfTGdv4myHxkVQN0",
  authDomain: "world-cup-2026-b2a15.firebaseapp.com",
  projectId: "world-cup-2026-b2a15",
  storageBucket: "world-cup-2026-b2a15.firebasestorage.app",
  messagingSenderId: "208102839169",
  appId: "1:208102839169:web:9f5ec692f4231728284e80"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
