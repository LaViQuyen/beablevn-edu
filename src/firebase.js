import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// Cấu hình trực tiếp (Không dùng .env)
export const firebaseConfig = {
  apiKey: "AIzaSyDib-AzfVlINhKd-EiiFhZq1PQwPCMMrBw",
  authDomain: "bavn-learning.firebaseapp.com",
  // QUAN TRỌNG: URL này đã được sửa thành 'bavn-learning' thay vì 'beablevn-learning' để khớp với database thực tế
  databaseURL: "https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bavn-learning",
  storageBucket: "bavn-learning.firebasestorage.app",
  messagingSenderId: "929043730121",
  appId: "1:929043730121:web:3f95e39b6bfe93d2f2c718",
  measurementId: "G-8TL2GYB1L8"
};

// 1. Khởi tạo App
const app = initializeApp(firebaseConfig);

// 2. Khởi tạo Database (Truyền URL cấu hình vào để đảm bảo kết nối đúng)
export const db = getDatabase(app, firebaseConfig.databaseURL);
export const storage = getStorage(app);
// 3. Khởi tạo Auth
export const auth = getAuth(app);
// 4. Khởi tạo Functions, PHẢI cùng region với function (asia-southeast1)
//    để httpsCallable gọi đúng endpoint. Dùng cho issueToken (cầu nối đăng nhập).
export const functions = getFunctions(app, "asia-southeast1");

export default app;