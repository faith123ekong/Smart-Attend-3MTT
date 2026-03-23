import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import { Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Default to student for new users
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: 'student',
              createdAt: Date.now(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth onLogin={() => setLoading(true)} />;
  }

  const renderDashboardContent = () => {
    switch (profile.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'lecturer':
        return <LecturerDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <Dashboard role={profile.role}>
      {renderDashboardContent()}
    </Dashboard>
  );
}

export default App;
