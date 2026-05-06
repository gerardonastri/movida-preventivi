// views/FooterNotesManager.tsx — FILE NUOVO

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFooterNotes, saveFooterNotes } from '../utils/storage';
import type { FooterNote } from '../utils/db';

export default function FooterNotesManager() {
  const [notes, setNotes] = useState<FooterNote[]>(() => getFooterNotes());
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editingId]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAddNew = () => {
    const newNote: FooterNote = {
      id: crypto.randomUUID(),
      content: 'NUOVA NOTA',
      sortOrder: notes.length,
    };
    const updated = [...notes, newNote];
    setNotes(updated);
    saveFooterNotes(updated);
    setEditingId(newNote.id);
    setEditValue(newNote.content);
  };

  const handleStartEdit = (note: FooterNote) => {
    setEditingId(note.id);
    setEditValue(note.content);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editValue.trim().toUpperCase();
    if (!trimmed) { setEditingId(null); return; }
    const updated = notes.map((n, i) =>
      n.id === id ? { ...n, content: trimmed, sortOrder: i } : n
    );
    setNotes(updated);
    saveFooterNotes(updated);
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(id); }
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Eliminare questa nota?')) return;
    const updated = notes.filter(n => n.id !== id).map((n, i) => ({ ...n, sortOrder: i }));
    setNotes(updated);
    saveFooterNotes(updated);
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur-sm pb-3 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Note piè di pagina</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {notes.length} {notes.length === 1 ? 'nota' : 'note'} · appaiono in fondo ai documenti
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + Aggiungi
          </button>
        </div>
      </div>

      {/* Lista */}
      <motion.ul className="flex flex-col gap-2" layout>
        <AnimatePresence>
          {notes.map((note, idx) => (
            <motion.li
              key={note.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="group flex items-start gap-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--accent)]/40 transition-all"
            >
              <span className="text-xs font-bold text-[var(--text-tertiary)] mt-1 w-5 text-center shrink-0">
                {idx + 1}
              </span>

              {editingId === note.id ? (
                <div className="flex-1 space-y-1">
                  <textarea
                    ref={textareaRef}
                    value={editValue}
                    rows={3}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => handleSaveEdit(note.id)}
                    onKeyDown={e => handleKeyDown(e, note.id)}
                    className="w-full bg-white border-2 border-[var(--accent)] rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-primary)] outline-none shadow-[0_0_0_3px_rgba(37,99,235,0.1)] resize-none"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    Invio per salvare · Shift+Invio per andare a capo · Esc per annullare
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => handleStartEdit(note)}
                  className="flex-1 text-left text-sm text-[var(--text-primary)] leading-relaxed hover:text-[var(--accent)] transition-colors"
                >
                  {note.content}
                </button>
              )}

              {editingId !== note.id && (
                <button
                  onClick={() => handleDelete(note.id)}
                  className="md:opacity-0 md:group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 mt-0.5"
                  title="Elimina nota"
                >
                  🗑️
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {notes.length === 0 && (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <div className="text-4xl mb-3">📝</div>
          <p className="font-medium text-[var(--text-primary)]">Nessuna nota</p>
          <p className="text-sm mt-1">Le note aggiunte appariranno in fondo a ogni documento.</p>
        </div>
      )}
    </div>
  );
}