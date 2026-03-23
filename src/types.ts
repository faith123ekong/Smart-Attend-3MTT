export type UserRole = 'admin' | 'lecturer' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface Session {
  id: string;
  lecturerId: string;
  courseName: string;
  startTime: number;
  endTime: number;
  qrCode: string;
  isActive: boolean;
}
