// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);