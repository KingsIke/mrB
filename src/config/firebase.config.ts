import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    // Load from file path (production / local dev)
    const fullPath = path.resolve(serviceAccountPath);
    if (fs.existsSync(fullPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase] Initialized from service account file');
      return firebaseApp;
    }
  }

  // Fallback: try to use application default credentials (e.g. Google Cloud environment)
  firebaseApp = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  console.log('[Firebase] Initialized from application default credentials');
  return firebaseApp;
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  return initializeFirebase().messaging();
}
