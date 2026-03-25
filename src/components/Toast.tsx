import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'info';
}

export default function Toast({ message, isVisible, type = 'success' }: ToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white px-5 py-3 rounded-full shadow-[var(--shadow-hover)] border border-[var(--border)]"
        >
          <span className="text-xl leading-none">
            {type === 'success' ? '✅' : 'ℹ️'}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}