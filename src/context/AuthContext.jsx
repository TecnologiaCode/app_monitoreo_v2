import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Importa tu cliente de Supabase

// 1. Crear el Contexto
const AuthContext = createContext();

// 2. Crear el Proveedor (AuthProvider)
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);       // La sesión completa de Supabase
  const [user, setUser] = useState(null);             // El objeto 'user'
  const [loading, setLoading] = useState(true); // Carga inicial de autenticación
  const [authError, setAuthError] = useState(null);   // Para manejar errores de login

  useEffect(() => {
    setLoading(true);
    setAuthError(null);

    // 1. Intenta obtener la sesión actual al cargar la app
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Error al obtener sesión:", error);
        setAuthError("Error al verificar la sesión. Reintenta más tarde.");
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // 2. Escucha cambios en el estado de autenticación (login, logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 3. Limpia el listener cuando el componente se desmonta
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Función de Login con Email y Contraseña
  const login = async (email, password) => {
    setAuthError(null); // Limpia errores antiguos
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) throw error;
      // El 'onAuthStateChange' se encargará de setear el usuario
    } catch (error) {
      console.error("Error en login:", error.message);
      if (error.message.includes("Invalid login credentials")) {
        setAuthError("Correo o contraseña incorrectos.");
      } else {
        setAuthError("Error al iniciar sesión: " + error.message);
      }
    }
  };

  // Función de Logout
  const logout = async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error en logout:", error.message);
      setAuthError("Error al cerrar sesión: " + error.message);
    }
  };

  // 4. El valor que proveerá el contexto
  const value = {
    session,
    user,
    login,
    logout,
    authError,
    isAuthenticated: !!session, // Verdadero si 'session' no es null
    loadingAuthState: loading, // Renombrado para coincidir con tu LoginPage
  };

  // 5. Retorna el proveedor
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. Crear y exportar el Hook 'useAuth'
export const useAuth = () => {
  return useContext(AuthContext);
};