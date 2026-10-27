import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  favoriteTeam?: string;
  lastLoginAt: string;
}

export async function validateFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'tournament', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline notice:', error.message);
    }
  }
}

// Sign in with Google Popup
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await syncUserProfile(result.user);
    }
    return result.user;
  } catch (error) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Synchronize and persist user data in Firestore
export async function syncUserProfile(user: FirebaseUser, additionalData: Partial<AppUserProfile> = {}) {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userDocRef);
    const existingData = existingSnap.exists() ? (existingSnap.data() as Partial<AppUserProfile>) : {};

    const rawProfile: Record<string, any> = {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      favoriteTeam: additionalData.favoriteTeam || existingData.favoriteTeam || '',
      lastLoginAt: new Date().toISOString(),
      ...additionalData,
    };

    const profileData: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawProfile)) {
      if (v !== undefined) {
        profileData[k] = v;
      }
    }

    await setDoc(userDocRef, profileData, { merge: true });
    return profileData as AppUserProfile;
  } catch (err) {
    console.warn('Could not persist user profile to Firestore:', err);
    return null;
  }
}

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<AppUserProfile | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as AppUserProfile;
    }
  } catch (err) {
    console.warn('Error reading user profile:', err);
  }
  return null;
}
