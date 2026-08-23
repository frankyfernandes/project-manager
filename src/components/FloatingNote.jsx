import React, { useState, useRef, useEffect } from 'react';
import { PencilLine, X, Send } from 'lucide-react';
import './FloatingNote.css';

const FloatingNote = ({ activeTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Track position relative to window (from bottom right)
  const [position, setPosition] = useState({ x: 32, y: 32 });
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 32, y: 32 });
  const didDrag = useRef(false);

  const activeProjectId = activeTab ? (activeTab.isProject ? activeTab.id : activeTab.project_id) : null;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      didDrag.current = true;
      
      const deltaX = startPos.current.x - e.clientX;
      const deltaY = startPos.current.y - e.clientY;
      
      let newX = currentPos.current.x + deltaX;
      let newY = currentPos.current.y + deltaY;
      
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX > window.innerWidth - 60) newX = window.innerWidth - 60;
      if (newY > window.innerHeight - 60) newY = window.innerHeight - 60;
      
      startPos.current = { x: e.clientX, y: e.clientY };
      currentPos.current = { x: newX, y: newY };
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    if (isOpen) return;
    if (e.button !== 2) return; // 2 is right click
    
    didDrag.current = false;
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e) => {
    if (e.button !== 0) return; // 0 is left click
    if (!activeProjectId) {
      alert("Please open a project file to append notes to its board.");
      return;
    }
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noteText.trim() || !activeProjectId) return;

    try {
      if (window.electronAPI) {
        await window.electronAPI.addInstantNote(activeProjectId, noteText.trim());
        window.dispatchEvent(new CustomEvent('kanban-updated', { detail: { projectId: activeProjectId } }));
      }
      setNoteText('');
      
      // Keep focus on textarea
      setTimeout(() => {
        const ta = document.querySelector('.floating-note-form textarea');
        if (ta) ta.focus();
      }, 0);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div 
      className={`floating-note-container ${isDragging ? 'dragging' : ''}`}
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`
      }}
    >
      {isOpen ? (
        <div 
          className="floating-note-modal animate-fade-in"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <div className="floating-note-header">
            <h4>Quick Note</h4>
            <button onClick={() => setIsOpen(false)} className="close-btn"><X size={14} /></button>
          </div>
          <form onSubmit={handleSubmit} className="floating-note-form">
            <textarea 
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Jot down a quick thought..."
              autoFocus
              style={{ WebkitUserSelect: 'text', userSelect: 'text', cursor: 'text' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
            />
            <div className="floating-note-actions">
              <span className="hint">Enter to submit</span>
              <button type="submit" disabled={!noteText.trim()} className="submit-btn">
                <Send size={14} /> Add to Board
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button 
          className="floating-note-fab"
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onContextMenu={(e) => e.preventDefault()}
          title={activeProjectId ? "Add Instant Note (Right-click to drag)" : "Open a project to add notes"}
          style={{ opacity: activeProjectId ? 1 : 0.5 }}
        >
          <PencilLine size={24} />
        </button>
      )}
    </div>
  );
};

export default FloatingNote;
