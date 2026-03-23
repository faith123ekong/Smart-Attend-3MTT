import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Course, Session, AttendanceRecord } from '../types';
import { 
  QrCode, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Clock,
  MapPin,
  ChevronRight,
  Loader2,
  BookOpen,
  Settings,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRScanner from './QRScanner';
import SyncQueue from './SyncQueue';
import Logo from './Logo';
import { createNotification } from '../services/notificationService';

interface StudentDashboardProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function StudentDashboard({ profile, activeTab, setActiveTab }: StudentDashboardProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    // Fetch student's attendance
    const qAttendance = query(
      collection(db, 'attendance'), 
      where('studentId', '==', profile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(records);

      // Check for low attendance (mock logic: if less than 5 records and user has been active)
      if (records.length > 0 && records.length < 3) {
        createNotification(
          profile.uid,
          'Low Attendance Warning',
          'Your attendance is currently below the required 75%. Please attend more classes.',
          'warning',
          'overview'
        );
      }
    });

    // Fetch all courses to map IDs
    const fetchCourses = async () => {
      const snapshot = await getDocs(collection(db, 'courses'));
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    };
    fetchCourses();

    setLoading(false);
    return () => unsubAttendance();
  }, [profile.uid]);

  if (showScanner) {
    return <QRScanner profile={profile} onClose={() => setShowScanner(false)} />;
  }

  if (activeTab === 'sessions') {
    return (
      <div className="space-y-6">
        <SyncQueue profile={profile} />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Available Sessions</h3>
          <button 
            onClick={() => setShowScanner(true)}
            className="btn-primary flex items-center gap-2"
          >
            <QrCode className="w-5 h-5" />
            Scan QR Code
          </button>
        </div>

        <div className="bg-primary rounded-2xl p-8 text-white relative overflow-hidden shadow-xl shadow-primary/20">
          <div className="relative z-10">
            <h4 className="text-2xl font-bold mb-2">Ready for class?</h4>
            <p className="text-white/80 mb-6 max-w-md">
              Scan the QR code displayed by your lecturer to mark your attendance. 
              Make sure you are within the classroom range.
            </p>
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-white text-primary px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <QrCode className="w-5 h-5" />
              Open Platform Scanner
            </button>
          </div>
          <QrCode className="absolute -right-10 -bottom-10 w-64 h-64 text-white/10 rotate-12" />
        </div>
      </div>
    );
  }

  if (activeTab === 'courses') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">My Courses</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">{course.code}</h4>
              <p className="text-slate-600 text-sm mb-2 line-clamp-2">{course.title}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{course.department}</span>
              </div>
            </motion.div>
          ))}
          {courses.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No courses assigned to you yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'settings') {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-body flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Profile & Preferences
            </h3>
            
            <div className="space-y-4">
              <div className="p-6 bg-surface rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary text-2xl font-bold">
                    {profile.displayName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-body text-lg">{profile.displayName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{profile.regNumber}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Email</span>
                    <span className="font-medium text-body">{profile.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Department</span>
                    <span className="font-medium text-body">{profile.department}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Role</span>
                    <span className="font-medium text-primary capitalize">{profile.role}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-body">Push Notifications</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive alerts for new sessions</p>
                  </div>
                  <button className="w-12 h-6 bg-primary rounded-full relative">
                    <div className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-body flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              About Application
            </h3>
            
            <div className="p-6 bg-surface rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <Logo className="w-12 h-12" />
                <div>
                  <p className="text-sm font-bold text-body">Attendance Tracker by 3MTT</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Version 1.0</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Education Pillar Project
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Knowledge Showcase Submission
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                A smart, secure, and efficient attendance management system designed for 3MTT fellows and educational institutions. Features include QR-based check-in, GPS verification, and real-time reporting.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Overview
  return (
    <div className="space-y-8">
      <SyncQueue profile={profile} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Present Days</p>
          <h3 className="text-2xl font-bold text-body">{attendance.length}</h3>
        </div>

        <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg. Attendance</p>
          <h3 className="text-2xl font-bold text-body">92%</h3>
        </div>

        <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Warnings</p>
          <h3 className="text-2xl font-bold text-body">0</h3>
        </div>
      </div>

      <div className="bg-bg rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-body">Attendance History</h3>
          <button className="text-sm text-primary font-semibold hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {attendance.slice(0, 5).map(record => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-bg rounded-lg flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 dark:border-slate-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-body">
                    {courses.find(c => c.id === record.courseId)?.code || 'Course'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(record.timestamp).toLocaleDateString()} at {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
                  {record.status}
                </span>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))}
          {attendance.length === 0 && (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">No attendance records yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
