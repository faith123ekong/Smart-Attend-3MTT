import React, { useState, useEffect } from 'react';
import { 
  collection, 
  setDoc,
  doc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { Course, Session } from '../types';
import { 
  X, 
  MapPin, 
  Clock, 
  Calendar, 
  BookOpen, 
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Navigation
} from 'lucide-react';
import { motion } from 'motion/react';
import { logAction } from '../utils/logger';
import { createNotification } from '../services/notificationService';

interface SessionCreatorProps {
  lecturerId: string;
  courses: Course[];
  onClose: () => void;
}

export default function SessionCreator({ lecturerId, courses, onClose }: SessionCreatorProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [trackingLocation, setTrackingLocation] = useState(false);

  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
    
    // Automatically track location when component mounts
    trackLocation();
  }, [courses, courseId]);

  const trackLocation = () => {
    if (navigator.geolocation) {
      setTrackingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toString());
          setLongitude(pos.coords.longitude.toString());
          setTrackingLocation(false);
        },
        (err) => {
          console.error("Location Error:", err);
          setTrackingLocation(false);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const start = new Date(startTime);
      const totalMinutes = (parseInt(durationHours) * 60) + parseInt(durationMinutes);
      const end = new Date(start.getTime() + totalMinutes * 60000);
      
      // QR expires 31 minutes after session start, OR at session end time (whichever is earlier)
      const qrExpiryTime = new Date(start.getTime() + 31 * 60000);
      const expiry = qrExpiryTime < end ? qrExpiryTime : end;

      const sessionRef = doc(collection(db, 'sessions'));
      const sessionData: Session = {
        id: sessionRef.id,
        courseId,
        lecturerId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationHours: totalMinutes / 60,
        venue,
        location: {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude)
        },
        qrCode: sessionRef.id, // Use ID as QR code
        expiresAt: expiry.toISOString()
      };

      await setDoc(sessionRef, sessionData);
      
      // Notify Lecturer
      await createNotification(
        lecturerId,
        'Session Created',
        `You have successfully created a session for ${courseId} at ${venue}.`,
        'success',
        'sessions'
      );

      // Notify Admins
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminDocs = await getDocs(adminQuery);
      adminDocs.forEach(adminDoc => {
        createNotification(
          adminDoc.id,
          'New Session Created',
          `Lecturer ${lecturerId} created a session for ${courseId}.`,
          'info',
          'sessions'
        );
      });
      
      // Log session creation
      await logAction(
        'session_created',
        `Session created for course ${courseId} at ${venue}`,
        sessionRef.id,
        courseId,
        lecturerId,
        undefined,
        lecturerId
      );

      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error("Session Creation Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-4xl mx-auto">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <h3 className="text-xl font-bold text-[#333333] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#186E23]" />
          Create Class Session
        </h3>
        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:bg-[#F4F7F4] rounded-xl transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-8">
        {success ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h4 className="text-2xl font-bold text-slate-900 mb-2">Session Created!</h4>
            <p className="text-slate-500">Redirecting to your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Select Course
                  </label>
                  {courses.length > 0 ? (
                    <div className="relative">
                      <select
                        required
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#186E23] outline-none transition-all bg-white pr-10"
                      >
                        <option value="" disabled>Choose a course...</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5" />
                      No courses assigned to you yet. Please contact the administrator.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Venue Name
                  </label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    placeholder="e.g. Hall 1, Faculty of Engineering"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Minutes
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        required
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#186E23] outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Venue Coordinates
                  </label>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {trackingLocation ? (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Detecting...
                      </span>
                    ) : latitude ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Location Locked
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Waiting for GPS...
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Note:</strong> Your current coordinates are automatically captured as the official class location. 
                    Please ensure you are at the class venue when creating this session. 
                    Students must be within 100m of your current position to mark attendance.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#186E23] text-white font-bold py-4 px-6 rounded-2xl hover:bg-[#145A1D] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Creating session...</span>
                </div>
              ) : 'Generate Session & QR Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
