import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA6L0L-aPIe6SxqjRz-lWZPdv1bcRJD3zg",
  authDomain: "pdv---lifesurf.firebaseapp.com",
  projectId: "pdv---lifesurf",
  storageBucket: "pdv---lifesurf.firebasestorage.app",
  messagingSenderId: "287539362216",
  appId: "1:287539362216:web:710fa401bd239fa246c59d",
  measurementId: "G-YHC3MYQ7F1"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

export const auth = getAuth(app);