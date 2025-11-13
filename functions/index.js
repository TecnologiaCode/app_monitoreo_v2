const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializa el Admin SDK
admin.initializeApp();

/**
 * Función HTTPS Callable para crear un nuevo usuario.
 * 1. Verifica que el que llama sea un Admin.
 * 2. Crea el usuario en Firebase Authentication.
 * 3. Crea el documento del usuario en Firestore.
 */
exports.createNewUser = functions.https.onCall(async (data, context) => {
  // --- 1. Verificación de Seguridad ---
  // Asegurarse de que el usuario que llama está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debes estar autenticado para crear usuarios.",
    );
  }

  // Verificar que el usuario que llama es un "Admin" en Firestore
  try {
    const adminUserDoc = await admin
      .firestore()
      .collection("usuarios")
      .doc(context.auth.uid)
      .get();
      
    if (!adminUserDoc.exists || adminUserDoc.data().rol !== "Admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tienes permisos de administrador para realizar esta acción.",
      );
    }
  } catch (error) {
    console.error("Error al verificar permisos de admin:", error);
    throw new functions.https.HttpsError("internal", "Error al verificar permisos.");
  }

  // --- 2. Recibir Datos ---
  const {
    email,
    password,
    nombreCompleto,
    username,
    rol,
    estado,
    descripcion,
  } = data;

  // Validar datos básicos
  if (!email || !password || !username || !nombreCompleto) {
     throw new functions.https.HttpsError(
      "invalid-argument",
      "Email, password, username y nombre completo son obligatorios.",
    );
  }
  
  // --- 3. Lógica de Creación ---
  try {
    // 3.1. Crear usuario en Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: nombreCompleto,
      emailVerified: true, // Opcional: marcar como verificado
      disabled: estado === "inactivo", // Sincronizar estado
    });

    // 3.2. Preparar datos para Firestore (SIN contraseña)
    const firestoreData = {
      ...data,
      email: email.toLowerCase(), // Normalizar
      username: username.toLowerCase(), // Normalizar
      fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      // ¡NUNCA GUARDAR LA CONTRASEÑA EN FIRESTORE!
      password: null, // O eliminar la propiedad
    };
    delete firestoreData.password; // Mejor eliminarla

    // 3.3. Crear documento en Firestore usando el UID de Auth como ID
    await admin
      .firestore()
      .collection("usuarios")
      .doc(userRecord.uid) // Usamos el UID de Auth
      .set(firestoreData);

    return { success: true, uid: userRecord.uid };

  } catch (error) {
    console.error("Error al crear el nuevo usuario:", error);
    // Manejar errores conocidos de Auth
    if (error.code === "auth/email-already-exists") {
       throw new functions.https.HttpsError(
        "already-exists",
        "El correo electrónico ya está en uso por otro usuario.",
      );
    }
    // Manejar otros errores
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Error interno al crear el usuario.",
    );
  }
});