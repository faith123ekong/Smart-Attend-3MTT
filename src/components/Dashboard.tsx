import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile, UserRole } from '../types';
import Logo from './Logo';
import { 
  LogOut, 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Calendar, 
  Settings,
  Bell,
  Menu,
  X,
  Star,
  Info,
  Loader2
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import LecturerDashboard from './LecturerDashboard';
import StudentDashboard from './StudentDashboard';
import NotificationPanel from './NotificationPanel';
import FeedbackForm from './FeedbackForm';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanupOldLocationData } from '../utils/syncManager';

interface DashboardProps {
  user: User;
  profile: UserProfile;
}

export default function Dashboard({ user, profile }: DashboardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<UserRole>(profile.role);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    // Run location cleanup only for admins
    if (profile.role === 'admin') {
      cleanupOldLocationData();
    }

    return () => unsubscribe();
  }, [user.uid]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'sessions', label: 'Sessions', icon: Calendar },
    ...(profile.role === 'admin' || profile.role === 'lecturer' ? [
      { id: 'users', label: 'User Management', icon: Users }
    ] : []),
    ...(profile.role === 'admin' ? [
      { id: 'logs', label: 'Session Logs', icon: LayoutDashboard }
    ] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    const effectiveProfile = { ...profile, role: viewMode };
    
    switch (viewMode) {
      case 'admin':
        return <AdminDashboard profile={effectiveProfile} activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'lecturer':
        return <LecturerDashboard profile={effectiveProfile} activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'student':
        return <StudentDashboard profile={effectiveProfile} activeTab={activeTab} setActiveTab={setActiveTab} />;
      default:
        return <div>Invalid Role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-bg border-r border-slate-200 dark:border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <Logo className="w-10 h-10 shadow-lg shadow-primary/10" />
          <span className="font-bold text-body text-lg leading-tight">
            Smart<br /><span className="text-primary">Attend</span>
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {profile.role === 'admin' && (
            <div className="mb-6 px-4">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                View Mode
              </label>
              <div className="flex bg-surface p-1 rounded-xl">
                {(['admin', 'lecturer', 'student'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => setViewMode(role)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${
                      viewMode === role
                        ? 'bg-bg text-primary shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-surface'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="mb-4 px-2">
            <div className="p-3 bg-surface rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">App Info</p>
              <p className="text-xs font-bold text-body">Attendance Tracker by 3MTT</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Version 1.0</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface rounded-xl mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
              {profile.displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-body truncate">{profile.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile.role}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowFeedback(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#186E23] font-medium hover:bg-[#F4F7F4] transition-all mb-2"
          >
            <Star className="w-5 h-5" />
            Rate App Usability
          </button>

          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 font-medium hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-bg border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="font-bold text-body">Smart Attend</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-surface rounded-lg relative"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-bg"></span>
              )}
            </button>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-surface rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-body">
                  Welcome back, {profile.displayName.split(' ')[0]}!
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3 relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={`p-2 rounded-xl transition-all relative ${
                    isNotificationsOpen 
                      ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                      : 'text-slate-400 dark:text-slate-500 hover:bg-bg hover:text-primary'
                  }`}
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className={`absolute top-2 right-2 w-2 h-2 rounded-full border-2 ${
                      isNotificationsOpen ? 'bg-white border-primary' : 'bg-red-500 border-bg'
                    }`}></span>
                  )}
                </button>
                
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 z-50"
                    >
                      <NotificationPanel 
                        userId={user.uid} 
                        onClose={() => setIsNotificationsOpen(false)}
                        onNavigate={(tab) => setActiveTab(tab)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {renderContent()}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showFeedback && (
          <FeedbackForm profile={profile} onClose={() => setShowFeedback(false)} />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-bg z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="p-2 flex items-center gap-3">
                  <Logo className="w-10 h-10" />
                  <span className="font-bold text-body text-lg">Smart Attend</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:bg-surface rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 px-4 space-y-1 mt-4">
                {profile.role === 'admin' && (
                  <div className="mb-6 px-4">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                      View Mode
                    </label>
                    <div className="flex bg-surface p-1 rounded-xl">
                      {(['admin', 'lecturer', 'student'] as UserRole[]).map((role) => (
                        <button
                          key={role}
                          onClick={() => setViewMode(role)}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${
                            viewMode === role
                              ? 'bg-bg text-primary shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-surface'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                <div className="mb-4 p-3 bg-surface rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">App Info</p>
                  <p className="text-xs font-bold text-body">Attendance Tracker by 3MTT</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Version 1.0</p>
                </div>
                <button
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
