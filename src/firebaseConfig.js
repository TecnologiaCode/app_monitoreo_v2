// --- firebaseConfig.js (FINAL - Sin Login Anónimo) ---
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Quitamos signInAnonymously de la importación
import { getAuth, signInWithCustomToken, setPersistence, browserLocalPersistence } from "firebase/auth";

// --- Variables Globales (Intento de Lectura) ---
const appIdGlobal = typeof __app_id !== 'undefined' ? __app_id : null;
const configStringGlobal = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

console.log("Firebase Cfg: Globals found? app_id:", !!appIdGlobal, "config:", !!configStringGlobal, "token:", !!initialAuthToken);
// --- FIN Variables Globales ---

// --- Configuración (Prioriza Global, luego Hardcoded) ---
let firebaseConfig = null;
let initializationSource = "unknown";

// Intenta usar la global PRIMERO
if (configStringGlobal && configStringGlobal.trim() !== '') {
  try {
    firebaseConfig = JSON.parse(configStringGlobal);
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      console.log("Firebase Cfg: Using GLOBAL config.");
      initializationSource = "global";
    } else {
      console.warn("Firebase Cfg: Global config parsed but missing keys. Falling back.");
      firebaseConfig = null;
    }
  } catch (e) { console.warn("Firebase Cfg: Failed to parse global config. Falling back.", e); firebaseConfig = null; }
} else { console.warn("Firebase Cfg: Global config not found. Falling back."); firebaseConfig = null; }

// SI la global falló, usa la hardcoded
if (!firebaseConfig) {
    initializationSource = "hardcoded";
    console.log("Firebase Cfg: Using HARDCODED config as fallback.");
    // ****** ASEGÚRATE QUE ESTAS SEAN TUS CREDENCIALES WEB CORRECTAS ******
    firebaseConfig = {
      apiKey: "AIzaSyDYaLgJQHkIWK5SD-v47YGwuhoAkMfK_Uc", // Tu API Key WEB
      authDomain: "metric-20f51.firebaseapp.com",     // Tu Auth Domain WEB
      projectId: "metric-20f51",                      // Tu Project ID
      storageBucket: "metric-20f51.appspot.com",       // Tu Storage Bucket WEB
      messagingSenderId: "88118519047",               // Tu Sender ID
      appId: "1:88118519047:web:e2294a694c0ff3ebee11a2" // Tu App ID WEB
    };
    // ****** FIN DE CREDENCIALES ******
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("Firebase Cfg: Hardcoded fallback is ALSO invalid!");
        firebaseConfig = null; initializationSource = "invalid_fallback";
    }
}
// --- FIN Configuración ---

// --- Inicialización Segura ---
let app;
let auth = null; let db = null; let initializationError = null;
const appIdToUse = appIdGlobal || firebaseConfig?.appId || 'default-app-id';

if (firebaseConfig) {
  try {
    console.log(`Firebase Cfg: Initializing App using ${initializationSource} config...`);
    app = initializeApp(firebaseConfig, appIdToUse);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase Cfg: App, Auth, Firestore initialized successfully.");

    // --- Autenticación Inicial (SOLO CON TOKEN, SIN ANÓNIMO) ---
    (async () => {
      // Flag para evitar doble inicialización
      let authInitialized = false;
      if (authInitialized || !auth) return;
      authInitialized = true;
      try {
         await setPersistence(auth, browserLocalPersistence);
         console.log("Firebase Cfg: Auth persistence set.");
        if (initialAuthToken) { // Intenta usar el token del entorno si existe
          console.log("Firebase Cfg: Attempting token sign-in...");
          await signInWithCustomToken(auth, initialAuthToken);
          console.log("Firebase Cfg: Token sign-in successful.");
        } else {
          // --- CORRECCIÓN: NO HACER NADA SI NO HAY TOKEN ---
          console.log("Firebase Cfg: No initial token found. Waiting for explicit user login.");
          // Ya NO llamamos a signInAnonymously()
          // --- FIN CORRECCIÓN ---
        }
      } catch (error) {
        initializationError = `Firebase Cfg: Error during initial sign-in: ${error.message}`;
        console.error(initializationError, error);
      }
    })();
    // --- FIN Autenticación Inicial ---

  } catch (initError) {
    initializationError = `Firebase Cfg: FATAL Error initializing: ${initError.message}`;
    console.error(initializationError, initError);
    auth = null; db = null;
  }
} else {
  initializationError = "Firebase Cfg: Init skipped: No valid config.";
  console.error(initializationError);
  auth = null; db = null;
}
// --- FIN Inicialización Segura ---

// --- Exportar Instancias ---
export { app, db, auth, initializationError };