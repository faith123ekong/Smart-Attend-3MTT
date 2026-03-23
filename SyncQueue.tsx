import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPendingSync, syncAttendance, clearSyncedRecords } from '../utils/syncManager';
import { OfflineAttendance, UserProfile } from '../types';

interface SyncQueueProps {
  profile: UserProfile;
}

export default function SyncQueue({ profile }: SyncQueueProps) {
  const [records, setRecords] = useState<OfflineAttendance[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadRecords = () => {
      setRecords(getPendingSync());
    };

    loadRecords();
    const interval = setInterval(loadRecords, 5000);

    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncAttendance(profile);
      setRecords(getPendingSync());
      
      const hasSynced = getPendingSync().some(r => r.syncStatus === 'synced');
      if (hasSynced) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setTimeout(clearSyncedRecords, 5000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (records.length === 0 && isOnline) return null;

  const pendingCount = records.filter(r => r.syncStatus === 'pending').length;
  const syncedCount = records.filter(r => r.syncStatus === 'synced').length;
  const rejectedCount = records.filter(r => r.syncStatus === 'rejected').length;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-bold">Attendance synced successfully</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-bg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${!isOnline ? 'bg-amber-100 text-amber-600' : isSyncing ? 'bg-[#F4F7F4] text-[#186E23]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : !isOnline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <h4 className="text-sm font-bold text-body">
                {isSyncing ? 'Syncing records...' : !isOnline ? 'Offline Mode' : 'Sync Queue'}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {!isOnline ? 'Will sync when online' : `${pendingCount} pending, ${syncedCount} synced`}
              </p>
            </div>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronUp className="w-5 h-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                {records.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-medium">All records synced</p>
                  </div>
                ) : (
                  records.map((record) => (
                    <div key={record.id} className="p-3 bg-surface rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-body truncate">{record.sessionName || 'Class Session'}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </p>
                        {record.syncError && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">{record.syncError}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {record.syncStatus === 'pending' && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-bold uppercase">
                            Pending
                          </span>
                        )}
                        {record.syncStatus === 'synced' && (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Synced
                          </span>
                        )}
                        {record.syncStatus === 'rejected' && (
                          <span className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {isOnline && pendingCount > 0 && (
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full bg-[#186E23] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#145A1D] transition-all flex items-center justify-center gap-2"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync Now
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
