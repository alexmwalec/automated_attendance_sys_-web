import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqGabmoGKq3dKf_5WAvXOdCPXb6PESD3U",
  authDomain: "automated-attendance-sys-9fc6b.firebaseapp.com",
  projectId: "automated-attendance-sys-9fc6b",
  storageBucket: "automated-attendance-sys-9fc6b.firebasestorage.app",
  messagingSenderId: "270698623484",
  appId: "1:270698623484:web:f1138b7caf338ac77b0279",
  measurementId: "G-776EXP7740"
};
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);