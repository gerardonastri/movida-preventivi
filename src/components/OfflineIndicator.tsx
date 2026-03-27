import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-9999 pointer-events-none"
        >
          <div className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-white/20 backdrop-blur-md">
            <span className="text-lg">🔌</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Modalità Offline - I dati verranno salvati localmente
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}