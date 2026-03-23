import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  Timestamp,
  orderBy,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Course, Session, AttendanceRecord } from '../types';
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  BookOpen,
  BarChart3, 
  QrCode,
  ChevronRight,
  Download,
  Loader2,
  Settings,
  X,
  ShieldCheck,
  Percent,
  Info,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SessionCreator from './SessionCreator';
import AttendanceList from './AttendanceList';
import SyncQueue from './SyncQueue';
import Logo from './Logo';

import { createNotification } from '../services/notificationService';

interface SessionSummaryProps {
  session: Session;
  totalStudents: number;
}

function SessionSummary({ session, totalStudents }: SessionSummaryProps) {
  const [counts, setCounts] = useState({ attended: 0, absent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('sessionId', '==', session.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const attended = snapshot.docs.length;
      setCounts({
        attended,
        absent: Math.max(0, totalStudents - attended)
      });
      setLoading(false);
    });
    return () => unsub();
  }, [session.id, totalStudents]);

  if (loading) return <div className="h-4 w-32 bg-slate-100 animate-pulse rounded mt-1" />;

  return (
    <p className="text-xs text-primary font-medium mt-1">
      {counts.attended} attended, {counts.absent} absent — tap to see details
    </p>
  );
}

interface LecturerDashboardProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function LecturerDashboard({ profile, activeTab, setActiveTab }: LecturerDashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showCourseSettings, setShowCourseSettings] = useState(false);

  const studentCount = users.filter(u => u.role === 'student' || u.role === 'class_rep').length;

  useEffect(() => {
    let unsubCourses: (() => void) | null = null;
    let unsubSessions: (() => void) | null = null;
    let unsubAllCourses: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

    try {
      const qCourses = query(collection(db, 'courses'), where('lecturerId', '==', profile.uid));
      unsubCourses = onSnapshot(qCourses, 
        (snapshot) => {
          setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
          setLoading(false);
        },
        (err) => {
          console.error("Courses Snapshot Error:", err);
          setLoading(false);
        }
      );

      unsubAllCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
        setAllCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      });

      const qUsers = query(collection(db, 'users'), where('role', 'in', ['student', 'class_rep']));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });

      const qSessions = query(
        collection(db, 'sessions'), 
        where('lecturerId', '==', profile.uid)
      );
      unsubSessions = onSnapshot(qSessions, 
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
          // Sort in memory to avoid index requirement
          docs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          setSessions(docs);
          setLoading(false);

          // Daily Attendance Summary Notification
          const today = new Date().toLocaleDateString();
          const todaySessions = docs.filter(s => new Date(s.startTime).toLocaleDateString() === today);
          if (todaySessions.length > 0) {
            createNotification(
              profile.uid,
              'Daily Attendance Summary',
              `You have ${todaySessions.length} sessions scheduled for today. Check the sessions tab for live updates.`,
              'info',
              'sessions'
            );
          }

          // Mock 3 consecutive absence alert
          if (docs.length > 0) {
             createNotification(
               profile.uid,
               'Absence Alert',
               'Some students have missed 3 consecutive classes. Review the attendance records for details.',
               'warning',
               'sessions'
             );
          }
        },
        (err) => {
          console.error("Sessions Snapshot Error:", err);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Dashboard Setup Error:", err);
      setLoading(false);
    }

    return () => {
      if (unsubCourses) unsubCourses();
      if (unsubSessions) unsubSessions();
      if (unsubAllCourses) unsubAllCourses();
      if (unsubUsers) unsubUsers();
    };
  }, [profile.uid]);

  const handleUpdateCourseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        minAttendance: editingCourse.minAttendance || 75,
        classRepId: editingCourse.classRepId || '',
        classRepCanOverride: editingCourse.classRepCanOverride || false
      });
      setShowCourseSettings(false);
      setEditingCourse(null);
    } catch (err: any) {
      console.error("Course Settings Update Error:", err);
      alert("Failed to update course settings: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  if (showCreateSession) {
    return (
      <SessionCreator 
        lecturerId={profile.uid} 
        courses={courses} 
        onClose={() => setShowCreateSession(false)} 
      />
    );
  }

  if (selectedSession) {
    return (
      <AttendanceList 
        session={selectedSession} 
        profile={profile}
        onClose={() => setSelectedSession(null)} 
      />
    );
  }

  if (activeTab === 'sessions') {
    return (
      <div className="space-y-6">
        <SyncQueue profile={profile} />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Class Sessions</h3>
          <button 
            onClick={() => setShowCreateSession(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Session
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {sessions.map((session) => {
              const isExpired = new Date() > new Date(session.endTime);
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedSession(session)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      isExpired ? 'bg-slate-100 text-slate-400' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                    }`}>
                      {isExpired ? <Lock className="w-7 h-7" /> : <Calendar className="w-7 h-7" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-slate-900">
                          {courses.find(c => c.id === session.courseId)?.code || 'Course'}
                        </h4>
                        {isExpired && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Clock className="w-4 h-4" />
                          {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <MapPin className="w-4 h-4" />
                          {session.venue}
                        </div>
                      </div>
                      <SessionSummary session={session} totalStudents={studentCount} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className={`text-sm font-bold ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>
                        {isExpired ? 'Ended' : 'Live'}
                      </p>
                      <p className="text-xs text-slate-400">Attendance Feed</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-primary transition-all" />
                  </div>
                </motion.div>
              );
            })}
        </div>
      </div>
    );
  }

  if (activeTab === 'catalog') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Course Catalog</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allCourses.map((course) => (
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
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Users className="w-3 h-3" />
                  <span>Lecturer: {users.find(u => u.uid === course.lecturerId)?.displayName || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{course.department}</span>
                  {course.lecturerId === profile.uid && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Your Course</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
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
              <p className="text-slate-600 text-sm mb-4 line-clamp-2">{course.title}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{course.department}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingCourse(course);
                      setShowCourseSettings(true);
                    }}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    title="Course Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowCreateSession(true)}
                    className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New Session
                  </button>
                </div>
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

        {/* Course Settings Modal */}
        <AnimatePresence>
          {showCourseSettings && editingCourse && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Course Settings</h3>
                    <p className="text-sm text-slate-500">{editingCourse.code}: {editingCourse.title}</p>
                  </div>
                  <button onClick={() => setShowCourseSettings(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateCourseSettings} className="space-y-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Percent className="w-4 h-4 text-primary" />
                      Minimum Attendance Percentage
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={editingCourse.minAttendance || 75}
                        onChange={(e) => setEditingCourse({...editingCourse, minAttendance: parseInt(e.target.value)})}
                        className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <span className="w-12 text-center font-bold text-primary">{editingCourse.minAttendance || 75}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Users className="w-4 h-4 text-primary" />
                      Class Representative
                    </label>
                    <select
                      value={editingCourse.classRepId || ''}
                      onChange={(e) => setEditingCourse({...editingCourse, classRepId: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary outline-none transition-all bg-white"
                    >
                      <option value="">Select a student...</option>
                      {users.filter(u => u.role === 'student' || u.role === 'class_rep').map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName} ({u.regNumber})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Allow Rep Overrides</p>
                        <p className="text-[10px] text-slate-500">Can mark students as Present manually</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingCourse({...editingCourse, classRepCanOverride: !editingCourse.classRepCanOverride})}
                      className={`w-12 h-6 rounded-full relative transition-all ${
                        editingCourse.classRepCanOverride ? 'bg-primary' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                        editingCourse.classRepCanOverride ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCourseSettings(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] btn-primary flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Settings'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (activeTab === 'users') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Student Management</h3>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Reg Number</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Department</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, idx) => (
                  <tr key={u.uid || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-bold">
                          {u.displayName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.regNumber || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.department || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold capitalize ${
                        u.role === 'class_rep' ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
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
                    <p className="font-bold text-body">Email Notifications</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive daily attendance summaries</p>
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
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">My Courses</p>
          <h3 className="text-2xl font-bold text-body">{courses.length}</h3>
        </div>

        <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Students</p>
          <h3 className="text-2xl font-bold text-body">142</h3>
        </div>

        <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 mb-4">
            <BarChart3 className="w-6 h-6" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg. Attendance</p>
          <h3 className="text-2xl font-bold text-body">78%</h3>
        </div>
      </div>

      <div className="bg-bg rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-body">Recent Sessions</h3>
          <button 
            onClick={() => setActiveTab('sessions')}
            className="text-sm text-primary font-semibold hover:underline"
          >
            View All
          </button>
        </div>
        <div className="space-y-4">
          {sessions.slice(0, 3).map(session => (
            <div key={session.id} className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-bg rounded-lg flex items-center justify-center text-primary shadow-sm border border-slate-100 dark:border-slate-800">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-body">{courses.find(c => c.id === session.courseId)?.code}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(session.startTime).toLocaleDateString()}</p>
                  <SessionSummary session={session} totalStudents={studentCount} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedSession(session)}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
