import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc, 
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../types';
import { Bell, X, Check, Trash2, ExternalLink, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationPanelProps {
  userId: string;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export default function NotificationPanel({ userId, onClose, onNavigate }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(newNotifications);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      if (unread.length === 0) return;

      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAll = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      onNavigate(n.link);
      onClose();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[600px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#186E23]" />
          <h3 className="font-bold text-[#333333]">Notifications</h3>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="bg-[#186E23] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={markAllAsRead}
            title="Mark all as read"
            className="p-2 text-slate-400 hover:text-[#186E23] hover:bg-[#F4F7F4] rounded-xl transition-all"
          >
            <Check className="w-4 h-4" />
          </button>
          <button 
            onClick={clearAll}
            title="Clear all"
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-[#186E23] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 text-sm">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <h4 className="text-slate-900 font-bold mb-1">No notifications</h4>
            <p className="text-slate-500 text-sm">We'll notify you when something important happens.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-all flex gap-3 group ${!n.read ? 'bg-[#F4F7F4]/50' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                  n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  n.type === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-[#F4F7F4] text-[#186E23]'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`text-sm font-bold truncate ${!n.read ? 'text-[#333333]' : 'text-slate-600'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(n.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                    {n.message}
                  </p>
                  {n.link && (
                    <span className="text-[10px] font-bold text-[#186E23] flex items-center gap-1 group-hover:underline">
                      View Details
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
                {!n.read && (
                  <div className="w-2 h-2 bg-[#186E23] rounded-full mt-2 flex-shrink-0 shadow-sm shadow-emerald-200"></div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {notifications.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Showing last 50 notifications
          </p>
        </div>
      )}
    </div>
  );
}
