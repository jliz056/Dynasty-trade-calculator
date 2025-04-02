import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAdJ-xT_Lx-pL24IpNPZ1KCTEL3nBATO7E",
  authDomain: "dynastytradecalculator.firebaseapp.com",
  projectId: "dynastytradecalculator",
  storageBucket: "dynastytradecalculator.appspot.com",
  messagingSenderId: "770245755285",
  appId: "1:770245755285:web:52c5f8b8a9c40ecab9ae12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app; 