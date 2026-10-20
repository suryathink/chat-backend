import fs from "fs";
import path from "path";
import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env";
import { logger } from "./logger";

const initFirebase = () => {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set");

  if (env.FIRESTORE_EMULATOR_HOST) {
    // firebase-admin reads FIRESTORE_EMULATOR_HOST itself; only a project id is needed.
    logger.info(`Firestore: using emulator at ${env.FIRESTORE_EMULATOR_HOST}`);
    return initializeApp({ projectId });
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT_PATH (real Firebase) or FIRESTORE_EMULATOR_HOST (emulator)",
    );
  }

  const keyPath = path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8")) as ServiceAccount;
  logger.info(`Firestore: using project "${projectId}"`);
  return initializeApp({ credential: cert(serviceAccount), projectId });
};

export const firestore = getFirestore(initFirebase());
