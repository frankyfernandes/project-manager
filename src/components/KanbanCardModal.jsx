import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { X, Clock } from 'lucide-react';
import './KanbanCardModal.css';

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{'list': 'ordered'}, {'list': 'bullet'}],
    ['link', 'image'],
    ['clean']
  ]
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'link', 'image'
];

export default function KanbanCardModal({ card, isOpen, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title || '');
      setType(card.type || 'task');
      setContent(card.content || '');
    }
  }, [isOpen, card]);

  if (!isOpen || !card) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...card,
      title: title.trim(),
      type,
      content
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="card-modal-overlay">
      <div className="card-modal-container animate-fade-in">
        <div className="card-modal-header">
          <input 
            type="text" 
            className="card-modal-title-input" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="Task Title..."
            autoFocus
          />
          <button className="card-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="card-modal-content">
          <div className="card-modal-main">
            <div className="card-modal-section">
              <label>Description</label>
              <div className="quill-wrapper">
                <ReactQuill 
                  theme="snow" 
                  value={content} 
                  onChange={setContent} 
                  modules={modules}
                  formats={formats}
                  placeholder="Add a more detailed description..."
                />
              </div>
            </div>

            <div className="card-modal-section">
              <label><Clock size={16} /> Activity History</label>
              <div className="card-modal-history">
                {card.history && card.history.map((event, i) => (
                  <div key={i} className="history-item">
                    <span className="history-time">{formatDate(event.timestamp)}</span>
                    <span className="history-action">
                      {event.action === 'created' ? (
                        'Created this task'
                      ) : (
                        <>Moved from <strong>{event.from}</strong> to <strong>{event.to}</strong></>
                      )}
                    </span>
                  </div>
                ))}
                {!card.history || card.history.length === 0 ? (
                  <div className="history-empty">No history recorded yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card-modal-sidebar">
            <div className="card-modal-property">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="card-modal-select">
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="issue">Issue</option>
                <option value="note">Note</option>
              </select>
            </div>
            
            <div className="card-modal-property">
              <label>Created</label>
              <div className="property-value">{card.createdAt ? formatDate(card.createdAt) : 'Unknown'}</div>
            </div>
          </div>
        </div>

        <div className="card-modal-footer">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} className="btn-submit">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
