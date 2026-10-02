import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import {
  loginWithEmail,
  logoutUser,
  sendPasswordReset,
  fetchUserProfile
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega ou recarrega os dados do perfil do Firestore
  const reloadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return;
    }
    const profile = await fetchUserProfile(firebaseUser.uid);
    setUserProfile(profile);
  }, []);

  // Monitora alterações de estado de autenticação do Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await reloadProfile(currentUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [reloadProfile]);

  // Ações de autenticação
  const handleLogin = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const loggedUser = await loginWithEmail(email, password);
      await reloadProfile(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  }, [reloadProfile]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResetPassword = useCallback(async (email) => {
    await sendPasswordReset(email);
  }, []);

  const value = useMemo(() => ({
    user,
    userProfile,
    role: userProfile?.role || null,
    empresaId: userProfile?.empresaId || null,
    unidadeId: userProfile?.unidadeId || null,
    isAuthenticated: Boolean(user && userProfile?.ativo !== false),
    isBlocked: Boolean(user && userProfile?.ativo === false),
    loading,
    login: handleLogin,
    logout: handleLogout,
    resetPassword: handleResetPassword,
    refreshProfile: () => reloadProfile(user)
  }), [user, userProfile, loading, handleLogin, handleLogout, handleResetPassword, reloadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook customizado para consumir o contexto de autenticação com segurança
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um <AuthProvider />");
  }
  return context;
}
