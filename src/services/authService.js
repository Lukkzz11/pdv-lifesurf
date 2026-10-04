import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { COLLECTIONS, USER_ROLES } from "../config/constants";

/**
 * Autentica usuário com e-mail e senha
 */
export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Encerra a sessão do usuário atual
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Envia e-mail de recuperação de senha
 */
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Busca os dados de perfil e permissões do usuário no Firestore
 * @param {string} uid - ID único do usuário no Firebase Auth
 * @returns {Promise<object|null>}
 */
export async function fetchUserProfile(uid) {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }

    // Se o documento ainda não existir, cria perfil padrão seguro
    const defaultProfile = {
      role: USER_ROLES.OPERADOR,
      empresaId: import.meta.env.VITE_DEFAULT_TENANT_ID || "lifesurf-principal",
      unidadeId: "matriz",
      ativo: true,
      criadoEm: serverTimestamp()
    };

    await setDoc(userDocRef, defaultProfile, { merge: true });
    return { id: uid, ...defaultProfile };
  } catch (error) {
    console.error("[authService] Erro ao carregar perfil do usuário:", error);
    // Em caso de falha de leitura (ex: permissões offline), retorna perfil básico operacional
    return {
      id: uid,
      role: USER_ROLES.OPERADOR,
      empresaId: import.meta.env.VITE_DEFAULT_TENANT_ID || "lifesurf-principal",
      unidadeId: "matriz",
      ativo: true
    };
  }
}
