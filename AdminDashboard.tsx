import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Course, Session, UserRole, SessionLog, Feedback } from '../types';
import { 
  Plus, 
  Search, 
  UserPlus, 
  BookOpen, 
  Users,
  Trash2, 
  Edit2, 
  ShieldAlert,
  Loader2,
  CheckCircle2,
  X,
  Smartphone,
  RefreshCw,
  History,
  Star,
  Info,
  Lock,
  Download,
  FileText,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SyncQueue from './SyncQueue';
import Logo from './Logo';

interface AdminDashboardProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ profile, activeTab, setActiveTab }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({ displayName: '', email: '', role: 'student' as UserRole, department: '', phoneNumber: '' });
  const [newCourse, setNewCourse] = useState({ code: '', title: '', lecturerId: '', department: '' });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      docs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setSessions(docs);
    });

    const unsubLogs = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionLog));
      docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(docs);
    });

    const unsubFeedback = onSnapshot(collection(db, 'feedback'), (snapshot) => {
      setFeedback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
    });

    // Check if courses are empty and add sample data if needed (for testing)
    const checkEmpty = async () => {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      if (coursesSnap.empty) {
        const sampleCourses = [
          { code: 'CSC 101', title: 'Introduction to Computer Science', lecturerId: profile.uid, department: 'Computer Science' },
          { code: 'MTH 101', title: 'Elementary Mathematics I', lecturerId: profile.uid, department: 'Mathematics' },
          { code: 'GST 101', title: 'Use of English', lecturerId: profile.uid, department: 'General Studies' }
        ];
        for (const c of sampleCourses) {
          const ref = doc(collection(db, 'courses'));
          await setDoc(ref, { ...c, id: ref.id });
        }
      }
    };
    checkEmpty();

    setLoading(false);
    return () => {
      unsubUsers();
      unsubCourses();
      unsubSessions();
      unsubLogs();
      unsubFeedback();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.role) return;
    setLoading(true);
    try {
      // Use email as ID for pre-registration (Auth.tsx will migrate it to UID on first login)
      const docRef = doc(db, 'users', newUser.email);
      const userProfile: UserProfile = {
        uid: newUser.email, // Temporary UID
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role as 'admin' | 'lecturer' | 'student',
        regNumber: newUser.regNumber,
        department: newUser.department,
        courses: newUser.courses,
        phoneNumber: newUser.phoneNumber
      };
      
      await setDoc(docRef, userProfile);
      setShowAddUser(false);
      setNewUser({
        email: '',
        displayName: '',
        role: 'student',
        regNumber: '',
        department: '',
        courses: [],
        phoneNumber: ''
      });
      alert('User profile created successfully. They can now sign in with Google.');
    } catch (err: any) {
      console.error("User Creation Error:", err);
      alert("Failed to create user: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
      setShowAddUser(false);
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const courseRef = doc(collection(db, 'courses'));
      await setDoc(courseRef, { ...newCourse, id: courseRef.id });
      setNewCourse({ code: '', title: '', lecturerId: '', department: '' });
      setShowAddCourse(false);
    } catch (err: any) {
      console.error("Course Creation Error:", err);
      alert("Failed to create course: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        code: editingCourse.code,
        title: editingCourse.title,
        lecturerId: editingCourse.lecturerId,
        department: editingCourse.department
      });

      // Update all sessions for this course to the new lecturerId
      const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('courseId', '==', editingCourse.id)));
      for (const sessionDoc of sessionsSnap.docs) {
        await updateDoc(doc(db, 'sessions', sessionDoc.id), {
          lecturerId: editingCourse.lecturerId
        });
      }

      setShowEditCourse(false);
      setEditingCourse(null);
    } catch (err: any) {
      console.error("Course Update Error:", err);
      alert("Failed to update course: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        email: editingUser.email,
        role: editingUser.role,
        department: editingUser.department || '',
        phoneNumber: editingUser.phoneNumber || '',
        regNumber: editingUser.regNumber || ''
      });
      setShowEditUser(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error("User Update Error:", err);
      alert("Failed to update user: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const lecturers = users.filter(u => u.role === 'lecturer' || u.role === 'admin');

  if (activeTab === 'users') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[#333333]">User Management</h3>
          <button 
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 bg-[#186E23] text-white px-4 py-2 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Email</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Device</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Role</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Department</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#F4F7F4] rounded-full flex items-center justify-center text-[#186E23] text-xs font-bold border border-[#186E23]/10">
                          {u.displayName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-[#333333]">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {u.deviceId ? (
                          <div className="flex items-center gap-1.5">
                            <Smartphone className={`w-4 h-4 ${u.deviceAllowed ? 'text-emerald-500' : 'text-amber-500'}`} />
                            <span className="text-xs font-medium text-slate-500 truncate max-w-[80px]">{u.deviceId.slice(0, 8)}...</span>
                            {!u.deviceAllowed && (
                              <button 
                                onClick={async () => {
                                  await updateDoc(doc(db, 'users', u.uid), { deviceAllowed: true });
                                }}
                                className="text-[10px] bg-[#F4F7F4] text-[#186E23] px-1.5 py-0.5 rounded hover:bg-[#E8F5E9] font-bold border border-[#186E23]/10"
                              >
                                Allow
                              </button>
                            )}
                            <button 
                              onClick={async () => {
                                if(confirm('Reset device for this user? They will be able to login from a new device once.')) {
                                  await updateDoc(doc(db, 'users', u.uid), { deviceId: null, deviceAllowed: true });
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-500"
                              title="Reset Device"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No device linked</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold capitalize ${
                        u.role === 'admin' ? 'bg-red-50 text-red-600' :
                        u.role === 'lecturer' ? 'bg-amber-50 text-amber-600' :
                        u.role === 'class_rep' ? 'bg-[#F4F7F4] text-[#186E23]' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.department || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingUser(u);
                            setShowEditUser(true);
                          }}
                          className="p-2 text-slate-400 hover:text-[#186E23] hover:bg-[#F4F7F4] rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if(confirm('Are you sure you want to delete this user?')) {
                              await deleteDoc(doc(db, 'users', u.uid));
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <select
                          value={u.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as UserRole;
                            await updateDoc(doc(db, 'users', u.uid), { role: newRole });
                          }}
                          className="text-xs bg-slate-100 border-none rounded-lg focus:ring-0 cursor-pointer"
                        >
                          <option value="student">Student</option>
                          <option value="class_rep">Class Rep</option>
                          <option value="lecturer">Lecturer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit User Modal */}
        <AnimatePresence>
          {showEditUser && editingUser && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-body">Edit User Profile</h3>
                  <button onClick={() => setShowEditUser(false)} className="p-2 hover:bg-bg rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editingUser.displayName}
                      onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                    <input
                      type="email"
                      required
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      >
                        <option value="student">Student</option>
                        <option value="class_rep">Class Rep</option>
                        <option value="lecturer">Lecturer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                      <input
                        type="text"
                        value={editingUser.department || ''}
                        onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                      <input
                        type="tel"
                        value={editingUser.phoneNumber || ''}
                        onChange={(e) => setEditingUser({...editingUser, phoneNumber: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                    {editingUser.role === 'student' && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reg Number</label>
                        <input
                          type="text"
                          value={editingUser.regNumber || ''}
                          onChange={(e) => setEditingUser({...editingUser, regNumber: e.target.value})}
                          className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditUser(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-bg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-[#186E23] text-white font-bold py-3 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update User'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add User Modal */}
        <AnimatePresence>
          {showAddUser && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-3xl p-8 max-w-xl w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-body">Add New User</h3>
                  <button onClick={() => setShowAddUser(false)} className="p-2 hover:bg-bg rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newUser.displayName}
                        onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                      <input
                        type="email"
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      >
                        <option value="student">Student</option>
                        <option value="class_rep">Class Rep</option>
                        <option value="lecturer">Lecturer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                      <input
                        type="text"
                        value={newUser.department}
                        onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="Computer Science"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={newUser.phoneNumber}
                        onChange={(e) => setNewUser({...newUser, phoneNumber: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="+234..."
                      />
                    </div>
                    {newUser.role === 'student' && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reg Number</label>
                        <input
                          type="text"
                          value={newUser.regNumber}
                          onChange={(e) => setNewUser({...newUser, regNumber: e.target.value})}
                          className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                          placeholder="2024/..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-bg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-[#186E23] text-white font-bold py-3 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create User'}
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

  if (activeTab === 'courses') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-body">Course Catalog</h3>
          <button 
            onClick={() => setShowAddCourse(true)}
            className="flex items-center gap-2 bg-[#186E23] text-white px-4 py-2 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100"
          >
            <Plus className="w-5 h-5" />
            New Course
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-bg rounded-xl flex items-center justify-center text-[#186E23] group-hover:bg-[#186E23] group-hover:text-white transition-all border border-[#186E23]/10">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      setEditingCourse(course);
                      setShowEditCourse(true);
                    }}
                    className="p-2 text-slate-400 hover:text-[#186E23] rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      if(confirm('Are you sure you want to delete this course?')) {
                        await deleteDoc(doc(db, 'courses', course.id));
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h4 className="text-lg font-bold text-body mb-1">{course.code}</h4>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-2 line-clamp-2">{course.title}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>Lecturer: {users.find(u => u.uid === course.lecturerId)?.displayName || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-50 dark:border-slate-800 pt-3">
                  <span className="bg-bg px-2 py-1 rounded-md">{course.department}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Course Modal */}
        <AnimatePresence>
          {showAddCourse && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-body">Create New Course</h3>
                  <button onClick={() => setShowAddCourse(false)} className="p-2 hover:bg-bg rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleAddCourse} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Course Code</label>
                      <input
                        type="text"
                        required
                        value={newCourse.code}
                        onChange={(e) => setNewCourse({...newCourse, code: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="e.g. CSC 301"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                      <input
                        type="text"
                        required
                        value={newCourse.department}
                        onChange={(e) => setNewCourse({...newCourse, department: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                        placeholder="e.g. Computer Science"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Course Title</label>
                    <input
                      type="text"
                      required
                      value={newCourse.title}
                      onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      placeholder="e.g. Introduction to Algorithms"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assign Lecturer</label>
                    <select
                      required
                      value={newCourse.lecturerId}
                      onChange={(e) => setNewCourse({...newCourse, lecturerId: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    >
                      <option value="">Select a lecturer...</option>
                      {lecturers.map(l => (
                        <option key={l.uid} value={l.uid}>{l.displayName} ({l.department})</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddCourse(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-bg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-[#186E23] text-white font-bold py-3 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Course'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEditCourse && editingCourse && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-body">Edit Course</h3>
                  <button onClick={() => setShowEditCourse(false)} className="p-2 hover:bg-bg rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateCourse} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Course Code</label>
                      <input
                        type="text"
                        required
                        value={editingCourse.code}
                        onChange={(e) => setEditingCourse({...editingCourse, code: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                      <input
                        type="text"
                        required
                        value={editingCourse.department}
                        onChange={(e) => setEditingCourse({...editingCourse, department: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Course Title</label>
                    <input
                      type="text"
                      required
                      value={editingCourse.title}
                      onChange={(e) => setEditingCourse({...editingCourse, title: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assign Lecturer</label>
                    <select
                      required
                      value={editingCourse.lecturerId}
                      onChange={(e) => setEditingCourse({...editingCourse, lecturerId: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-bg text-body focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    >
                      <option value="">Select a lecturer...</option>
                      {lecturers.map(l => (
                        <option key={l.uid} value={l.uid}>{l.displayName} ({l.department})</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditCourse(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-bg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-[#186E23] text-white font-bold py-3 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Course'}
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

  if (activeTab === 'sessions') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-body">All Class Sessions</h3>
        </div>

        <div className="bg-bg rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Course</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Lecturer</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Venue</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Time</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((s) => {
                  const course = courses.find(c => c.id === s.courseId);
                  const lecturer = users.find(u => u.uid === s.lecturerId);
                  const isExpired = new Date(s.expiresAt) < new Date();
                  
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-body">{course?.code || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{course?.title}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{lecturer?.displayName || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{s.venue}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(s.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            isExpired ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                          }`}>
                            {isExpired ? 'Expired' : 'Active'}
                          </span>
                          {isExpired && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg uppercase">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'logs') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-body">System Logs</h3>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <History className="w-4 h-4" />
            <span>Last 100 actions</span>
          </div>
        </div>

        <div className="bg-bg rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Timestamp</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">User</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Action</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-body">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{log.userId?.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        log.action.includes('rejected') ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                        log.action.includes('success') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                        log.action.includes('created') ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                        'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {JSON.stringify(log.details)}
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
              System Preferences
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-surface rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-body">Dark Mode</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Adjust app appearance</p>
                  </div>
                  <button 
                    onClick={() => {
                      document.documentElement.classList.toggle('dark');
                      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      document.documentElement.classList.contains('dark') ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      document.documentElement.classList.contains('dark') ? 'left-7' : 'left-1'
                    }`} />
                  </button>
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
      
      {/* Feedback Summary Section */}
      <div className="bg-bg p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-surface rounded-2xl text-[#186E23]">
            <Star className="w-6 h-6 fill-current" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-body">User Experience Feedback</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Summary of app usability ratings</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Very easy', color: 'bg-emerald-500' },
            { label: 'Easy', color: 'bg-emerald-400' },
            { label: 'Moderate', color: 'bg-amber-400' },
            { label: 'Difficult', color: 'bg-orange-400' },
            { label: 'Very difficult', color: 'bg-red-500' },
          ].map((r) => {
            const count = feedback.filter(f => f.rating === r.label).length;
            return (
              <div key={r.label} className="p-4 bg-surface rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                <div className={`w-3 h-3 rounded-full ${r.color} mb-2`} />
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{r.label}</p>
                <h4 className="text-2xl font-bold text-body">{count}</h4>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-surface rounded-xl text-[#186E23]">
            <Users className="w-6 h-6" />
          </div>
          <button 
            onClick={() => setActiveTab('users')}
            className="text-xs font-bold text-[#186E23] hover:underline"
          >
            View All
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Users</p>
        <h3 className="text-2xl font-bold text-body">{users.length}</h3>
      </div>

      <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <button 
            onClick={() => setActiveTab('courses')}
            className="text-xs font-bold text-amber-600 hover:underline"
          >
            View All
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Courses</p>
        <h3 className="text-2xl font-bold text-body">{courses.length}</h3>
      </div>

      <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <button 
            onClick={() => setActiveTab('sessions')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            View All
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Sessions</p>
        <h3 className="text-2xl font-bold text-body">{sessions.length}</h3>
      </div>

      <div className="bg-bg p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Alerts</p>
        <h3 className="text-2xl font-bold text-body">3</h3>
      </div>
    </div>
  </div>
  );
}
