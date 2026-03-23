import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc,
  query, 
  where, 
  getDocs,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Session, AttendanceRecord } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  MapPin,
  ShieldCheck,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { logAction } from '../utils/logger';
import { saveOfflineAttendance } from '../utils/syncManager';
import { createNotification } from '../services/notificationService';

interface QRScannerProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function QRScanner({ profile, onClose }: QRScannerProps) {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string; isOffline?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    trackLocation();

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    async function onScanSuccess(decodedText: string) {
      scanner.clear();
      setScanning(false);
      // Refresh location one last time before processing
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(newLoc);
            handleAttendance(decodedText, newLoc);
          },
          () => {
            handleAttendance(decodedText, location);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        handleAttendance(decodedText, location);
      }
    }

    function onScanFailure(error: any) {
      // console.warn(`Code scan error = ${error}`);
    }

    return () => {
      scanner.clear();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const trackLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location Error:", err),
        { enableHighAccuracy: true }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const handleAttendance = async (sessionId: string, currentLoc: { lat: number; lng: number } | null = location) => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        // Offline Mode
        const now = new Date();
        const currentDeviceId = localStorage.getItem('attendance_device_id') || 'unknown';
        
        const offlineRecord: any = {
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          studentId: profile.uid,
          studentName: profile.displayName,
          regNumber: profile.regNumber || 'N/A',
          department: profile.department || 'N/A',
          courseId: 'pending', // Will be updated during sync
          timestamp: now.toISOString(),
          status: 'present', // Initial status, will be validated during sync
          location: currentLoc || { lat: 0, lng: 0 },
          deviceId: currentDeviceId,
          syncStatus: 'pending',
          sessionName: 'Offline Session'
        };

        saveOfflineAttendance(offlineRecord);
        await logAction('offline_checkin', `Offline attendance saved for user ${profile.email}`, sessionId, 'pending', profile.uid, profile.displayName);
        
        setResult({ 
          success: true, 
          message: "Offline — will sync when online", 
          isOffline: true 
        });
        return;
      }

      // 1. Fetch Session
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        setResult({ success: false, message: "Invalid QR Code. Session not found." });
        return;
      }

      const session = sessionSnap.data() as Session;
      const now = new Date();
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);

      // 2. Check Expiry (Class End Time)
      if (now > endTime) {
        setResult({ 
          success: false, 
          message: "Attendance session is locked. The class has ended." 
        });
        await logAction('scan_rejected', `Scan rejected for user ${profile.email}: Class ended.`, sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        return;
      }

      // 3. Device Check
      const currentDeviceId = localStorage.getItem('attendance_device_id');
      if (profile.role === 'student' && profile.deviceId && profile.deviceId !== currentDeviceId && !profile.deviceAllowed) {
        setResult({ 
          success: false, 
          message: "Device mismatch. You can only mark attendance from your registered device." 
        });
        
        // Notify Admins
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          createNotification(
            adminDoc.id,
            'Device Mismatch Detected',
            `Student ${profile.displayName} attempted to scan with an unregistered device.`,
            'error',
            'logs'
          );
        });

        await logAction('device_rejected', `Attendance rejected for user ${profile.email}: Device mismatch.`, sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        return;
      }

      // 4. Check Location (100m range)
      let isWithinRange = false;
      if (currentLoc) {
        const distance = calculateDistance(
          currentLoc.lat, currentLoc.lng,
          session.location.lat, session.location.lng
        );
        
        // Relax distance check for admin testing
        const isAdmin = profile.email === 'faith123ekong@gmail.com';
        if (distance <= 100 || isAdmin) {
          isWithinRange = true;
        }
      }

      if (!isWithinRange) {
        setResult({ 
          success: false, 
          message: "Location mismatch. You must be at the class venue to mark attendance." 
        });
        await logAction('scan_rejected', `Scan rejected for user ${profile.email}: Out of range.`, sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        return;
      }

      // 5. Check if already marked
      const q = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', profile.uid)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        setResult({ success: false, message: "You have already marked attendance for this session." });
        return;
      }

      // 6. Determine Status (20-min rule)
      const diffInMinutes = (now.getTime() - startTime.getTime()) / 60000;
      const status = diffInMinutes <= 20 ? 'present' : 'late';

      // 7. Mark Attendance
      const attendanceRef = doc(collection(db, 'attendance'));
      const attendanceRecord: AttendanceRecord = {
        id: attendanceRef.id,
        sessionId,
        studentId: profile.uid,
        studentName: profile.displayName,
        regNumber: profile.regNumber || 'N/A',
        department: profile.department || 'N/A',
        courseId: session.courseId,
        lecturerId: session.lecturerId,
        timestamp: now.toISOString(),
        status,
        location: currentLoc || { lat: 0, lng: 0 },
        deviceId: currentDeviceId || undefined
      };

      await setDoc(attendanceRef, attendanceRecord);
      
      // Notify Student
      if (status === 'present') {
        await createNotification(
          profile.uid,
          'Attendance Marked',
          `Your attendance for ${session.courseId} has been marked successfully.`,
          'success',
          'overview'
        );
      } else {
        await createNotification(
          profile.uid,
          'Late Attendance',
          `Your attendance for ${session.courseId} was marked as LATE.`,
          'warning',
          'overview'
        );
      }

      // Log success
      await logAction(
        status === 'present' ? 'scan_success' : 'late',
        `Attendance marked as ${status} for user ${profile.email}`,
        sessionId,
        session.courseId,
        profile.uid,
        profile.displayName,
        session.lecturerId
      );

      setResult({ success: true, message: `Attendance marked as ${status.toUpperCase()} successfully!` });
    } catch (error) {
      console.error("Attendance Error:", error);
      setResult({ success: false, message: "An error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-primary flex items-center gap-2">
            <Camera className="w-6 h-6" />
            Scan QR Code
          </h3>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase border border-amber-100">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-8">
          {scanning ? (
            <div className="space-y-6">
              <div id="reader" className="overflow-hidden rounded-2xl border-2 border-primary/10"></div>
              <div className="flex flex-col gap-4">
          {/* Location tracking is background-only */}
                {!isOnline && (
                  <div className="flex items-center gap-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                    <WifiOff className="w-5 h-5" />
                    Offline Mode — will sync later
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-slate-500 bg-surface p-3 rounded-xl border border-slate-100">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Anti-cheating system active
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-primary/50" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-900 font-bold">Verifying Attendance</p>
                    <p className="text-slate-500 text-sm">Checking location and device security...</p>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-6"
                >
                  {result?.success ? (
                    <div className={`w-20 h-20 ${result.isOffline ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      {result.isOffline ? <RefreshCw className="w-12 h-12 animate-spin-slow" /> : <CheckCircle2 className="w-12 h-12" />}
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-12 h-12" />
                    </div>
                  )}
                  <h4 className={`text-xl font-bold ${result?.success ? (result.isOffline ? 'text-amber-600' : 'text-emerald-600') : 'text-red-600'}`}>
                    {result?.success ? (result.isOffline ? 'Offline Saved' : 'Success!') : 'Failed'}
                  </h4>
                  <p className="text-slate-600 font-medium">{result?.message}</p>
                  
                  <button
                    onClick={onClose}
                    className="btn-primary w-full"
                  >
                    Close Scanner
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
