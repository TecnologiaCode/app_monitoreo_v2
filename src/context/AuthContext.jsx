import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';
import { supabase } from '../supabaseClient';
import { ROLE_DEFAULTS } from '../constants/permissions.js';  // CAMBIO: usamos defaults por rol

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Estado base de autenticación
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Perfil y permisos cargados desde la tabla profiles
  const [profile, setProfile] = useState(null);
  const [permisos, setPermisos] = useState([]);

  /**
   * Cargar perfil desde Supabase
   * Devuelve el perfil cargado para que login() pueda usarlo.
   */
  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      setPermisos([]);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.error('Error cargando perfil:', error);
        return null;
      }

      if (data) {
        setProfile(data);

        // CAMBIO CLAVE: usamos la columna correcta permisos_usuarios
        let perms = Array.isArray(data.permisos_usuarios)
          ? data.permisos_usuarios
          : [];

        // CAMBIO: si no tiene permisos explícitos, usamos defaults por rol
        if ((!perms || perms.length === 0) && data.rol && ROLE_DEFAULTS[data.rol]) {
          perms = ROLE_DEFAULTS[data.rol];
        }

        setPermisos(Array.isArray(perms) ? perms : []);

        return data;
      }

      // Si no hay perfil
      setProfile(null);
      setPermisos([]);
      return null;
    } catch (err) {
      console.error('Error loadProfile:', err);
      setProfile(null);
      setPermisos([]);
      return null;
    }
  }, []);

  /**
   * Efecto de inicialización:
   * - Obtiene sesión inicial
   * - Escucha cambios de auth
   */
  useEffect(() => {
    setLoading(true);

    // 1. Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Suscripción a cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        // ProtectedRoute manejará la UI mientras llega el perfil
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setPermisos([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  /**
   * Login con verificación de estado (activo / inactivo)
   */
  const login = async (email, password) => {
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user?.id) {
        const profileData = await loadProfile(data.user.id); // CAMBIO: ahora carga bien permisos_usuarios

        // Bloqueo de usuarios inactivos
        if (profileData && profileData.estado === 'inactivo') {
          const inactiveMsg =
            'Usuario inactivo, contáctese con el administrador.';

          await supabase.auth.signOut();
          setProfile(null);
          setPermisos([]);
          setSession(null);
          setUser(null);
          setAuthError(inactiveMsg);

          throw new Error('USER_INACTIVE');
        }
      }
    } catch (error) {
      if (error.message !== 'USER_INACTIVE') {
        setAuthError(error.message || 'Error al iniciar sesión');
      }
      throw error;
    }
  };

  /**
   * Logout manual
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setPermisos([]);
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error.message);
    }
  };

  /**
   * Verificación de permisos
   */
  const can = useCallback(
    (permisoRequerido) => {
      // Si no se pide permiso concreto, no restringimos
      if (!permisoRequerido) return true;

      // Admin siempre pasa
      if (profile?.rol === 'Admin') return true;

      // Caso general: verificar en el array de permisos
      return permisos.includes(permisoRequerido);
    },
    [permisos, profile]
  );

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated: !!session,
      loadingAuthState: loading,
      authError,
      profile,
      permisos,
      can,
      login,
      logout,
    }),
    [session, user, loading, authError, profile, permisos, can]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
