import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Utilitário de serviço para isolamento multiempresa no Firestore.
 * Garante que todas as operações pertençam ao tenant correto.
 */

/**
 * Retorna uma referência de coleção dentro da hierarquia da empresa
 * Formato: empresas/{tenantId}/{subColecao}
 */
export function getTenantSubCollection(tenantId, subCollectionName) {
  if (!tenantId) {
    throw new Error("[tenantFirestoreService] tenantId é obrigatório para acessar a subcoleção.");
  }
  return collection(db, "empresas", tenantId, subCollectionName);
}

/**
 * Cria ou atualiza um documento garantindo o campo `empresaId` e timestamp
 */
export async function saveTenantDocument(tenantId, collectionName, docData, docId = null) {
  if (!tenantId) {
    throw new Error("[tenantFirestoreService] tenantId é obrigatório para salvar o documento.");
  }

  const payload = {
    ...docData,
    empresaId: tenantId,
    atualizadoEm: serverTimestamp()
  };

  const colRef = collection(db, collectionName);

  if (docId) {
    const docRef = doc(colRef, docId);
    await setDoc(docRef, payload, { merge: true });
    return docId;
  } else {
    payload.criadoEm = serverTimestamp();
    const docRef = await addDoc(colRef, payload);
    return docRef.id;
  }
}

/**
 * Retorna uma query base já filtrada pelo tenantId ativo
 */
export function createTenantQuery(tenantId, collectionName, ...queryConstraints) {
  if (!tenantId) {
    throw new Error("[tenantFirestoreService] tenantId é obrigatório para filtrar documentos.");
  }
  const colRef = collection(db, collectionName);
  return query(colRef, where("empresaId", "==", tenantId), ...queryConstraints);
}
