import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  User,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole, UserProfile } from '../types';
import Logo from './Logo';
import { LogIn, UserPlus, BookOpen, ShieldCheck, Loader2, ShieldAlert, User as UserIcon, LogOut, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

import { logAction } from '../utils/logger';

interface AuthProps {
  initialUser?: User;
}

const getDeviceId = () => {
  let deviceId = localStorage.getItem('attendance_device_id');
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('attendance_device_id', deviceId);
  }
  return deviceId;
};

const CACHED_USER_KEY = 'smart_attend_cached_user';

export default function Auth({ initialUser }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'register' | 'device_rejected' | 'cached_login'>(initialUser ? 'register' : 'login');
  const [role, setRole] = useState<UserRole>('student');
  const [regNumber, setRegNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState(initialUser?.displayName || '');
  const [error, setError] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(CACHED_USER_KEY);
    if (saved && !initialUser) {
      try {
        const profile = JSON.parse(saved) as UserProfile;
        setCachedUser(profile);
        setStep('cached_login');
      } catch (e) {
        localStorage.removeItem(CACHED_USER_KEY);
      }
    }
  }, [initialUser]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await processLogin(user);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "Failed to sign in. Please check if popups are blocked.");
    } finally {
      setLoading(false);
    }
  };

  const processLogin = async (user: User) => {
    const currentDeviceId = getDeviceId();
    
    // Check if profile exists by UID
    const docRef = doc(db, 'users', user.uid);
    let docSnap;
    try {
      docSnap = await getDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
    
    if (docSnap && docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      
      // Device Limit Check
      if (profile.role === 'student') {
        if (!profile.deviceId) {
          // First login, save device ID
          await setDoc(doc(db, 'users', user.uid), { deviceId: currentDeviceId }, { merge: true });
          profile.deviceId = currentDeviceId;
        } else if (profile.deviceId !== currentDeviceId && !profile.deviceAllowed) {
          // Different device and not allowed by admin
          setStep('device_rejected');
          await logAction(
            'device_rejected',
            `Login rejected for user ${user.email} due to device mismatch.`,
            undefined,
            undefined,
            user.uid
          );
          return;
        }
      }

      // Cache user profile for next time
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(profile));
    } else {
      // Check if a pre-registered profile exists by email
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const querySnap = await getDocs(q);
      
      if (!querySnap.empty) {
        // Found a pre-registered profile, migrate it to UID-based ID
        const preRegData = querySnap.docs[0].data() as UserProfile;
        const preRegId = querySnap.docs[0].id;
        
        const newProfile = { 
          ...preRegData, 
          uid: user.uid,
          deviceId: currentDeviceId // Save device ID on first login
        };
        await setDoc(doc(db, 'users', user.uid), newProfile);
        
        // Delete the old pre-reg document if it had a different ID
        if (preRegId !== user.uid) {
          await deleteDoc(doc(db, 'users', preRegId));
        }

        // Cache user profile
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(newProfile));
      } else {
        setStep('register');
        setDisplayName(user.displayName || '');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = initialUser || auth.currentUser;
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const currentDeviceId = getDeviceId();
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        displayName: displayName || user.displayName || 'User',
        role: user.email === 'faith123ekong@gmail.com' ? 'admin' : role,
        department,
        phoneNumber,
        courses: [],
        deviceId: currentDeviceId,
        ...(role === 'student' ? { regNumber } : {})
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(profile));
    } catch (err: any) {
      console.error("Registration Error:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (formattedErr: any) {
        setError(formattedErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem(CACHED_USER_KEY);
    setCachedUser(null);
    setStep('login');
    signOut(auth);
  };

  if (step === 'device_rejected') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-surface rounded-2xl shadow-xl overflow-hidden border border-red-200 dark:border-red-900/50 p-8 text-center"
        >
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-body mb-4">Login not allowed on this device</h2>
          <p className="text-body mb-8">
            This account is already linked to another device. For security reasons, you can only use one device to mark attendance.
          </p>
          <div className="p-4 bg-bg rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 mb-8">
            If you have changed your device, please contact the <strong>Administrator</strong> or your <strong>Lecturer</strong> to reset your device link.
          </div>
          <button
            onClick={() => signOut(auth).then(() => setStep('login'))}
            className="btn-primary w-full"
          >
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <Logo className="w-16 h-16 shadow-lg shadow-primary/20" />
          </div>
          
          <h1 className="text-2xl font-bold text-center text-body mb-2">
            Smart Attend
          </h1>
          <p className="text-center text-body mb-1">
            by 3MTT Fellow
          </p>
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg uppercase tracking-wider">
              Version 1.0
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 text-red-600 text-sm">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
              {error.includes('auth/unauthorized-domain') && (
                <p className="font-medium">
                  Please add this domain ({window.location.hostname}) to your Firebase Auth authorized domains list.
                </p>
              )}
              <p className="text-slate-500 text-xs">
                Try opening the app in a new tab if popups are blocked.
              </p>
              <button 
                onClick={handleGoogleLogin}
                className="mt-2 text-xs font-bold text-primary hover:underline"
              >
                Try Again
              </button>
            </div>
          )}

          {step === 'cached_login' && cachedUser && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Welcome back!</p>
                <div className="flex items-center gap-4 p-4 bg-bg rounded-2xl border border-slate-200 dark:border-slate-800 mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1 overflow-hidden">
                    <p className="font-bold text-body truncate">{cachedUser.displayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{cachedUser.role}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing you in...</span>
                    </div>
                  ) : (
                    <>
                      Continue as {cachedUser.displayName.split(' ')[0]}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleSwitchAccount}
                  className="mt-6 text-sm font-medium text-slate-500 hover:text-primary flex items-center justify-center gap-2 mx-auto"
                >
                  <LogOut className="w-4 h-4" />
                  Switch account
                </button>
              </div>
            </div>
          )}

          {step === 'login' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-bg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-3 px-4 rounded-xl hover:bg-surface transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Sign in with Google
                  </>
                )}
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-800"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-slate-500 dark:text-slate-400">Secure Access</span>
                </div>
              </div>
              
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                Only registered students and staff can access the platform.
              </p>
            </div>
          )}

          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-semibold text-body mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Complete Your Profile
              </h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">I am a...</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
                      role === 'student' 
                        ? 'bg-primary/10 border-primary text-primary' 
                        : 'bg-bg border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-surface'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('lecturer')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
                      role === 'lecturer' 
                        ? 'bg-primary/10 border-primary text-primary' 
                        : 'bg-bg border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-surface'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Lecturer
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Registration Number</label>
                  <input
                    type="text"
                    required
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="e.g. UNN/2023/123456"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="e.g. Computer Science"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="e.g. +234 800 000 0000"
                />
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-surface transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] btn-primary flex items-center justify-center"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving profile...</span>
                    </div>
                  ) : 'Complete Registration'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
