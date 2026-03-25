import { motion } from 'framer-motion';

type View = 'dashboard' | 'new' | 'quotes' | 'settings';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  quoteCount: number;
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',       icon: '▦' },
  { id: 'new',       label: 'Nuovo preventivo', icon: '+' },
  { id: 'quotes',    label: 'Preventivi',       icon: '≡' },
  { id: 'settings',  label: 'Impostazioni',     icon: '⚙' },
];

export default function Sidebar({ activeView, onNavigate, quoteCount }: SidebarProps) {
  return (
    <aside className="
      hidden md:flex flex-col
      w-60 min-h-screen
      bg-white border-r border-[var(--border)]
      px-4 py-6 gap-2
      fixed left-0 top-0 z-20
    ">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 pb-6 mb-2 border-b border-[var(--border)]">
        <div className="
          w-9 h-9 rounded-xl bg-accent
          flex items-center justify-center
          shadow-card text-white text-lg font-bold
        ">P</div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">Preventivi</p>
          <p className="text-xs text-[var(--text-muted)]">Event Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(item => {
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium text-left transition-all duration-150
                ${isActive
                  ? 'bg-accent-soft text-accent shadow-card'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              <span className={`text-base w-5 text-center ${isActive ? 'text-accent' : 'text-[var(--text-muted)]'}`}>
                {item.icon}
              </span>
              {item.label}
              {item.id === 'quotes' && quoteCount > 0 && (
                <span className="ml-auto text-xs bg-accent text-white rounded-full px-2 py-0.5 font-semibold">
                  {quoteCount}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">v1.0.0 · Local-first</p>
      </div>
    </aside>
  );
}