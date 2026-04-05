import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZHCMwzGHvodsgbX4la3B763KYeFzPm5Y",
  authDomain: "beablevn-system.firebaseapp.com",
  databaseURL: "https://beablevn-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beablevn-system",
  storageBucket: "beablevn-system.firebasestorage.app",
  messagingSenderId: "17618073710",
  appId: "1:17618073710:web:0b9cf14c1f1d8125f1ce7f",
  measurementId: "G-4Q65DS3EQX"
};

const app = initializeApp(firebaseConfig);

// CÁC DÒNG EXPORT BẮT BUỘC PHẢI CÓ CHO REACT:
export const auth = getAuth(app);
export const db = getDatabase(app);         // Dành cho Edu (Realtime DB)
export const firestore = getFirestore(app);  // Dành cho Assignment (Firestore)