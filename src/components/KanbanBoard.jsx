import React, { useState, useEffect } from 'react';
import { Plus, X, GripVertical, CheckCircle2, Bug, AlertCircle, FileText } from 'lucide-react';
import KanbanCardModal from './KanbanCardModal';
import './KanbanBoard.css';

const DEFAULT_BOARD = {
  columns: [
    { id: 'todo', title: 'To-Do', cards: [] },
    { id: 'in-progress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ]
};

export default function KanbanBoard({ initialData, onSave }) {
  const [boardData, setBoardData] = useState(DEFAULT_BOARD);
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedOverCol, setDraggedOverCol] = useState(null);
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', value: '', onSubmit: null });
  
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [editingCardColId, setEditingCardColId] = useState(null);

  const requestPrompt = (title, onSubmit) => {
    setPromptConfig({ isOpen: true, title, value: '', onSubmit });
  };

  const handlePromptSubmit = (e) => {
    e.preventDefault();
    if (promptConfig.value.trim() && promptConfig.onSubmit) {
      promptConfig.onSubmit(promptConfig.value.trim());
    }
    setPromptConfig({ isOpen: false, title: '', value: '', onSubmit: null });
  };

  useEffect(() => {
    try {
      if (initialData && initialData.trim() !== '') {
        const parsed = JSON.parse(initialData);
        if (parsed.columns && Array.isArray(parsed.columns)) {
          setBoardData(parsed);
        } else if (parsed.columns && typeof parsed.columns === 'object') {
          // Auto-migrate from the old corrupted object format back to the array format
          console.warn("Migrating old Kanban data format...");
          const newColumns = [];
          const order = parsed.columnOrder || Object.keys(parsed.columns);
          
          for (const colId of order) {
            const oldCol = parsed.columns[colId];
            if (oldCol) {
              const cards = (oldCol.taskIds || []).map(taskId => parsed.tasks?.[taskId]).filter(Boolean);
              newColumns.push({
                id: oldCol.id || colId,
                title: oldCol.title || colId,
                cards: cards
              });
            }
          }
          
          const migrated = { columns: newColumns.length > 0 ? newColumns : DEFAULT_BOARD.columns };
          setBoardData(migrated);
          onSave(JSON.stringify(migrated, null, 2));
        } else {
          setBoardData(DEFAULT_BOARD);
          onSave(JSON.stringify(DEFAULT_BOARD, null, 2));
        }
      } else {
        setBoardData(DEFAULT_BOARD);
        onSave(JSON.stringify(DEFAULT_BOARD, null, 2));
      }
    } catch (e) {
      console.error('Invalid board data', e);
      setBoardData(DEFAULT_BOARD);
      onSave(JSON.stringify(DEFAULT_BOARD, null, 2));
    }
  }, [initialData]);

  const handleSave = (newData) => {
    setBoardData(newData);
    onSave(JSON.stringify(newData, null, 2));
  };

  const handleAddCard = (colId) => {
    const newCard = {
      id: crypto.randomUUID(),
      title: '',
      type: 'task',
      content: '',
      createdAt: new Date().toISOString(),
      history: [{ timestamp: new Date().toISOString(), action: 'created' }]
    };
    setEditingCard(newCard);
    setEditingCardColId(colId);
    setIsCardModalOpen(true);
  };

  const handleCardClick = (colId, card) => {
    setEditingCard(card);
    setEditingCardColId(colId);
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (updatedCard) => {
    const newColumns = boardData.columns.map(col => {
      if (col.id === editingCardColId) {
        const cardExists = col.cards.find(c => c.id === updatedCard.id);
        if (cardExists) {
          return { ...col, cards: col.cards.map(c => c.id === updatedCard.id ? updatedCard : c) };
        } else {
          return { ...col, cards: [...col.cards, updatedCard] };
        }
      }
      return col;
    });
    handleSave({ ...boardData, columns: newColumns });
    setIsCardModalOpen(false);
    setEditingCard(null);
    setEditingCardColId(null);
  };

  const handleAddColumn = () => {
    requestPrompt('Enter column title:', (title) => {
      const newCol = {
        id: crypto.randomUUID(),
        title,
        cards: []
      };
      handleSave({ ...boardData, columns: [...boardData.columns, newCol] });
    });
  };

  const handleDeleteCard = (colId, cardId) => {
    const newColumns = boardData.columns.map(col => {
      if (col.id === colId) {
        return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
      }
      return col;
    });

    handleSave({ ...boardData, columns: newColumns });
  };

  const handleDragStart = (e, card, sourceColId) => {
    setDraggedCard({ card, sourceColId });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedCard(null);
    setDraggedOverCol(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverCol !== colId) {
      setDraggedOverCol(colId);
    }
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedCard) return;

    const { card, sourceColId } = draggedCard;
    if (sourceColId === targetColId) {
      setDraggedOverCol(null);
      return;
    }

    const sourceCol = boardData.columns.find(c => c.id === sourceColId);
    const targetCol = boardData.columns.find(c => c.id === targetColId);

    const updatedCard = {
      ...card,
      history: [
        ...(card.history || []),
        {
          timestamp: new Date().toISOString(),
          action: 'moved',
          from: sourceCol.title,
          to: targetCol.title
        }
      ]
    };

    const newColumns = boardData.columns.map(col => {
      if (col.id === sourceColId) {
        return { ...col, cards: col.cards.filter(c => c.id !== card.id) };
      }
      if (col.id === targetColId) {
        return { ...col, cards: [...col.cards, updatedCard] };
      }
      return col;
    });

    handleSave({ ...boardData, columns: newColumns });
    setDraggedOverCol(null);
  };

  return (
    <div className="kanban-container">
      {boardData.columns.map(col => (
        <div 
          key={col.id} 
          className={`kanban-col ${draggedOverCol === col.id ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, col.id)}
          onDrop={(e) => handleDrop(e, col.id)}
        >
          <div className="kanban-col-header">
            <h3>{col.title} <span className="card-count">{col.cards.length}</span></h3>
            <button onClick={() => handleAddCard(col.id)} className="kanban-add-btn">
              <Plus size={16} />
            </button>
          </div>
          
          <div className="kanban-col-content">
            {col.cards.map(card => (
              <div 
                key={card.id} 
                className="kanban-card"
                draggable
                onDragStart={(e) => handleDragStart(e, card, col.id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleCardClick(col.id, card)}
              >
                <div className="kanban-card-drag-handle" onClick={(e) => e.stopPropagation()}><GripVertical size={14} /></div>
                <div className="kanban-card-main">
                  <div className="kanban-card-badges">
                    {card.type === 'bug' && <span className="kanban-badge bug"><Bug size={10} /> Bug</span>}
                    {card.type === 'issue' && <span className="kanban-badge issue"><AlertCircle size={10} /> Issue</span>}
                    {card.type === 'note' && <span className="kanban-badge note"><FileText size={10} /> Note</span>}
                    {(!card.type || card.type === 'task') && <span className="kanban-badge task"><CheckCircle2 size={10} /> Task</span>}
                  </div>
                  <div className="kanban-card-title">{card.title}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(col.id, card.id); }} className="kanban-card-delete">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="kanban-add-column-wrapper">
        <button onClick={handleAddColumn} className="kanban-add-column-btn">
          <Plus size={16} /> Add Column
        </button>
      </div>

      {promptConfig.isOpen && (
        <div className="prompt-overlay">
          <div className="prompt-modal animate-fade-in">
            <div className="prompt-header">
              <h3>{promptConfig.title}</h3>
              <button onClick={() => setPromptConfig({ isOpen: false, title: '', value: '', onSubmit: null })} className="close-btn"><X size={16} /></button>
            </div>
            <form onSubmit={handlePromptSubmit}>
              <input 
                type="text" 
                autoFocus
                value={promptConfig.value} 
                onChange={e => setPromptConfig({...promptConfig, value: e.target.value})}
                placeholder="Enter title..."
              />
              <div className="prompt-actions">
                <button type="button" onClick={() => setPromptConfig({ isOpen: false, title: '', value: '', onSubmit: null })} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-submit">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <KanbanCardModal 
        isOpen={isCardModalOpen} 
        card={editingCard} 
        onClose={() => { setIsCardModalOpen(false); setEditingCard(null); setEditingCardColId(null); }} 
        onSave={handleSaveCard} 
      />
    </div>
  );
}
