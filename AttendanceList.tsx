import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Session, AttendanceRecord, UserProfile, Course, SessionLog } from '../types';
import { logAction } from '../utils/logger';
import { 
  X, 
  Download, 
  Users, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  QrCode,
  Search,
  Loader2,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../services/notificationService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface AttendanceListProps {
  session: Session;
  profile: UserProfile;
  onClose: () => void;
}

export default function AttendanceList({ session, profile, onClose }: AttendanceListProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [rejections, setRejections] = useState<SessionLog[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Fetch Course
    const fetchCourse = async () => {
      const docSnap = await getDoc(doc(db, 'courses', session.courseId));
      if (docSnap.exists()) setCourse(docSnap.data() as Course);
    };
    fetchCourse();

    // Fetch All Students for Override
    const qStudents = query(collection(db, 'users'), where('role', 'in', ['student', 'class_rep']));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllStudents(users);
    });

    // Fetch Attendance
    const q = query(collection(db, 'attendance'), where('sessionId', '==', session.id));
    const unsubAttendance = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(records);
      setLoading(false);
    });

    // Fetch Rejections
    const qRejections = query(
      collection(db, 'logs'), 
      where('sessionId', '==', session.id),
      where('action', 'in', ['scan_rejected', 'sync_rejected', 'device_rejected'])
    );
    const unsubRejections = onSnapshot(qRejections, (snapshot) => {
      setRejections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionLog)));
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubRejections();
    };
  }, [session.id]);

  const canOverride = 
    profile.role === 'admin' || 
    profile.role === 'lecturer' || 
    (profile.role === 'class_rep' && course?.classRepId === profile.uid && course?.classRepCanOverride);

  const handleOverride = async (student: UserProfile) => {
    if (!canOverride) {
      alert("You do not have permission to override attendance.");
      return;
    }

    const alreadyMarked = attendance.find(r => r.studentId === student.uid);
    if (alreadyMarked) {
      alert(`${student.displayName} has already marked attendance.`);
      return;
    }

    if (!confirm(`Manually mark ${student.displayName} as Present (Override)?`)) return;

    try {
      const recordRef = doc(collection(db, 'attendance'));
      const record: Omit<AttendanceRecord, 'id'> = {
        sessionId: session.id,
        studentId: student.uid,
        studentName: student.displayName,
        regNumber: student.regNumber || 'N/A',
        department: student.department || 'N/A',
        courseId: session.courseId,
        lecturerId: session.lecturerId,
        timestamp: new Date().toISOString(),
        status: 'override',
        location: session.location, // Use session location for override
        overriddenBy: profile.displayName
      };

      await setDoc(recordRef, record);
      
      // Notify Lecturer (the one who did the override)
      await createNotification(
        profile.uid,
        'Override Successful',
        `You have manually marked ${student.displayName} as present.`,
        'success',
        'sessions'
      );

      // Notify Admins
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminDocs = await getDocs(adminQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id !== profile.uid) { // Don't notify if the admin is the one who did the override
          createNotification(
            adminDoc.id,
            'Manual Override Used',
            `${profile.displayName} used manual override for ${student.displayName}.`,
            'warning',
            'sessions'
          );
        }
      });

      // Log the action
      await logAction(
        'override',
        `Manual override for ${student.displayName} (${student.regNumber})`,
        session.id,
        session.courseId,
        profile.uid,
        profile.displayName,
        session.lecturerId
      );

      alert(`Attendance marked for ${student.displayName}`);
      setShowOverrideModal(false);
    } catch (err: any) {
      console.error("Override Error:", err);
      alert("Failed to override attendance: " + err.message);
    }
  };

  const departments = ['All', ...new Set(attendance.map(r => r.department || 'N/A'))];

  const filteredAttendance = attendance.filter(record => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      record.studentName.toLowerCase().includes(search) ||
      record.regNumber.toLowerCase().includes(search)
    );
    const matchesDept = selectedDepartment === 'All' || record.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const filteredStudents = allStudents.filter(student => {
    const search = studentSearchTerm.toLowerCase();
    const isNotMarked = !attendance.some(r => r.studentId === student.uid);
    return isNotMarked && (
      student.displayName.toLowerCase().includes(search) ||
      (student.regNumber?.toLowerCase().includes(search))
    );
  });

  const downloadExcel = async () => {
    setIsExporting(true);
    try {
      const headers = ['Name', 'Registration Number', 'Department', 'Status', 'Timestamp', 'Overridden By'];
      const rows = filteredAttendance.map(r => [
        r.studentName,
        r.regNumber,
        r.department || 'N/A',
        r.status,
        new Date(r.timestamp).toLocaleString(),
        r.overriddenBy || ''
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
      XLSX.writeFile(workbook, `attendance_${course?.code || 'session'}_${new Date(session.startTime).toLocaleDateString()}.xlsx`);

      // Notify Admin
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminDocs = await getDocs(adminQuery);
      adminDocs.forEach(adminDoc => {
        createNotification(
          adminDoc.id,
          'Report Generated',
          `${profile.displayName} generated an Excel attendance report for ${course?.code || 'a session'}.`,
          'info',
          'logs'
        );
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.text(`${course?.code || 'Course'} Attendance Report`, 14, 15);
      doc.text(`Session: ${new Date(session.startTime).toLocaleDateString()} at ${session.venue}`, 14, 25);
      
      const headers = [['Name', 'Reg Number', 'Department', 'Status', 'Time']];
      const rows = filteredAttendance.map(r => [
        r.studentName,
        r.regNumber,
        r.department || 'N/A',
        r.status,
        new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ]);

      (doc as any).autoTable({
        head: headers,
        body: rows,
        startY: 35,
      });

      doc.save(`attendance_${course?.code || 'session'}_${new Date(session.startTime).toLocaleDateString()}.pdf`);

      // Notify Admin
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminDocs = await getDocs(adminQuery);
      adminDocs.forEach(adminDoc => {
        createNotification(
          adminDoc.id,
          'Report Generated',
          `${profile.displayName} generated a PDF attendance report for ${course?.code || 'a session'}.`,
          'info',
          'logs'
        );
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-white rounded-xl transition-all shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-[#333333]">{course?.code || 'Loading...'} Attendance</h3>
            <p className="text-sm text-slate-500 flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(session.startTime).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {session.venue}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canOverride && (
            <button 
              onClick={() => setShowOverrideModal(true)}
              className="flex items-center gap-2 bg-white text-[#186E23] px-4 py-2 rounded-xl border border-[#186E23]/20 hover:bg-[#F4F7F4] transition-all shadow-sm font-bold"
            >
              <Users className="w-5 h-5" />
              Manual Override
            </button>
          )}
          <button 
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <QrCode className="w-5 h-5" />
            Show QR
          </button>
          <button 
            onClick={downloadPDF}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50 transition-all shadow-sm font-bold disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            PDF
          </button>
          <button 
            onClick={downloadExcel}
            disabled={isExporting}
            className="flex items-center gap-2 bg-[#186E23] text-white px-4 py-2 rounded-xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Total Present</p>
          <h4 className="text-3xl font-bold text-[#333333]">{attendance.length}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">On Time</p>
          <h4 className="text-3xl font-bold text-emerald-600">
            {attendance.filter(r => r.status === 'present').length}
          </h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Late Arrivals</p>
          <h4 className="text-3xl font-bold text-amber-600">
            {attendance.filter(r => r.status === 'late').length}
          </h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Rejections</p>
          <h4 className={`text-3xl font-bold ${rejections.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {rejections.length}
          </h4>
        </div>
      </div>

      {rejections.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h5 className="text-sm font-bold text-red-900">Device/Location Rejections Detected</h5>
            <p className="text-xs text-red-700 mt-1">
              {rejections.length} attempts were blocked due to location mismatch, device sharing, or expired QR codes.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#186E23] outline-none bg-white transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Dept:</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#186E23] outline-none bg-white transition-all text-sm font-medium"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-500 font-medium ml-auto">
            Showing {filteredAttendance.length} records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Student</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Reg Number</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Department</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredAttendance.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#F4F7F4] rounded-full flex items-center justify-center text-[#186E23] text-xs font-bold border border-[#186E23]/10">
                        {record.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#333333]">{record.studentName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {record.regNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {record.department || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      record.status === 'present' ? 'bg-emerald-50 text-emerald-600' : 
                      record.status === 'late' ? 'bg-amber-50 text-amber-600' :
                      'bg-[#F4F7F4] text-[#186E23]'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-400 italic">
                    {record.overriddenBy ? `Overridden by ${record.overriddenBy}` : ''}
                  </td>
                </tr>
              ))}
              {!loading && filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Modal */}
      <AnimatePresence>
        {showOverrideModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-xl font-bold text-[#333333]">Manual Override</h4>
                  <p className="text-sm text-slate-500">Search and mark students present</p>
                </div>
                <button onClick={() => setShowOverrideModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search by name or reg number..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#186E23] outline-none bg-slate-50 transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredStudents.map(student => (
                  <div 
                    key={student.uid}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#186E23] font-bold shadow-sm border border-[#186E23]/10">
                        {student.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#333333]">{student.displayName}</p>
                        <p className="text-xs text-slate-500">{student.regNumber}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOverride(student)}
                      className="bg-white text-[#186E23] px-4 py-2 rounded-xl border border-[#186E23]/10 hover:bg-[#186E23] hover:text-white transition-all text-xs font-bold shadow-sm"
                    >
                      Mark Present
                    </button>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <p>No students found or all already marked.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-xl font-bold text-[#333333]">Scan to Mark</h4>
                <button onClick={() => setShowQR(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-2xl border-4 border-[#186E23] inline-block mb-6 shadow-lg">
                <QRCodeSVG 
                  value={session.id} 
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-[#186E23] font-bold">
                  <Clock className="w-5 h-5" />
                  Expires in 5 minutes
                </div>
                <p className="text-sm text-slate-500">
                  Students must use the platform scanner and be within 100m of the venue.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
