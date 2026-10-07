import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * CREDENCIAIS DEDICADAS DO FIREBASE DA ARENA SANDPLAY
 * TOTALMENTE ISOLADO DO FIREBASE DA LIFE SURF.
 * Projeto: arenasandplay-fc30f
 */
export const ARENA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIaSJmum3zGffNPOApFnHde9y3_L_PAnY",
  authDomain: "arenasandplay-fc30f.firebaseapp.com",
  projectId: "arenasandplay-fc30f",
  storageBucket: "arenasandplay-fc30f.firebasestorage.app",
  messagingSenderId: "559182170902",
  appId: "1:559182170902:web:dde2cfc26c9761069a1e37",
  measurementId: "G-RPFEX7GDYW"
};

const ARENA_CUSTOM_STORAGE_KEY = "arena_firebase_custom_config";

/**
 * Retorna as credenciais configuradas para o Firebase dedicado da Arena Sandplay.
 * Prioridade:
 * 1. Configuração salva pelo usuário no Painel (localStorage)
 * 2. Credenciais oficiais dedicadas da Arena Sandplay (arenasandplay-fc30f)
 */
export function getArenaFirebaseConfig() {
  try {
    const custom = localStorage.getItem(ARENA_CUSTOM_STORAGE_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.apiKey && parsed.projectId) {
        return {
          ...parsed,
          source: "custom_storage"
        };
      }
    }
  } catch (err) {
    console.warn("[ArenaFirebase] Erro ao carregar config customizada:", err);
  }

  return {
    ...ARENA_FIREBASE_CONFIG,
    source: "dedicated_arena"
  };
}

export function isDedicatedArenaFirebaseConfigured() {
  return true;
}

export function saveArenaCustomFirebaseConfig(config) {
  if (!config.apiKey || !config.projectId) {
    throw new Error("API Key e Project ID são obrigatórios para o Firebase da Arena.");
  }
  localStorage.setItem(ARENA_CUSTOM_STORAGE_KEY, JSON.stringify(config));
  window.location.reload();
}

export function clearArenaCustomFirebaseConfig() {
  localStorage.removeItem(ARENA_CUSTOM_STORAGE_KEY);
  window.location.reload();
}

// Inicializa a instância dedicada e isolada do Firebase para a Arena Sandplay
const ARENA_APP_NAME = "arena-sandplay-app";
let arenaAppInstance = null;
let arenaDbInstance = null;
let arenaAuthInstance = null;
let arenaStorageInstance = null;

try {
  const arenaConfig = getArenaFirebaseConfig();
  const existingApp = getApps().find((a) => a.name === ARENA_APP_NAME);

  if (existingApp) {
    arenaAppInstance = existingApp;
  } else {
    arenaAppInstance = initializeApp(arenaConfig, ARENA_APP_NAME);
  }

  arenaDbInstance = initializeFirestore(arenaAppInstance, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
  arenaAuthInstance = getAuth(arenaAppInstance);
  arenaStorageInstance = getStorage(arenaAppInstance);
} catch (err) {
  console.error("[ArenaFirebase] Erro ao inicializar app Arena Sandplay:", err);
}

export const arenaApp = arenaAppInstance;
export const arenaDb = arenaDbInstance;
export const arenaAuth = arenaAuthInstance;
export const arenaStorage = arenaStorageInstance;

export default arenaApp;
