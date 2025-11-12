import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBB1GVIoUhHzV_2MvRFVeLJbr2ZmCHfcAE",
  authDomain: "sibatechx.firebaseapp.com",
  projectId: "sibatechx",
  storageBucket: "sibatechx.firebasestorage.app", // We won't use this
  messagingSenderId: "153536701523",
  appId: "1:153536701523:web:e99654ed897d05892d52a6",
  measurementId: "G-687RBNJF96"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;