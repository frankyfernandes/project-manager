import React, { useState, useEffect, useRef } from 'react';
import { Search, File, Folder, Link as LinkIcon, X } from 'lucide-react';
import './CommandPalette.css';

export default function CommandPalette({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  
  console.log("CommandPalette rendered, isOpen:", isOpen, "items count:", items.length);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      loadItems();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadItems = async () => {
    if (window.electronAPI) {
      const tree = await window.electronAPI.getTree();
      const flatList = [];
      
      const flatten = (nodes, path = '') => {
        for (const node of nodes) {
          const currentPath = path ? `${path} / ${node.name}` : node.name;
          flatList.push({ ...node, displayPath: currentPath });
          if (node.children) {
            flatten(node.children, currentPath);
          }
        }
      };
      
      flatten(tree);
      // Filter out folders to only allow jumping to files
      setItems(flatList.filter(item => item.type === 'file'));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, query, items]);

  const filteredItems = items.filter(item => {
    if (!item || !item.name) return false;
    return item.name.toLowerCase().includes(query.toLowerCase()) || 
           (item.url && item.url.toLowerCase().includes(query.toLowerCase()));
  }).slice(0, 10); // Limit to 10 results for better UX

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <Search size={20} className="command-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search files and links..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button className="command-palette-close" onClick={onClose}><X size={16}/></button>
        </div>
        
        {filteredItems.length > 0 && (
          <ul className="command-palette-list">
            {filteredItems.map((item, index) => (
              <li 
                key={item.id} 
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <div className="command-palette-item-icon">
                  {item.name.endsWith('.link') ? <LinkIcon size={16} /> : <File size={16} />}
                </div>
                <div className="command-palette-item-content">
                  <div className="command-palette-item-name">{item.name}</div>
                  <div className="command-palette-item-path">{item.displayPath}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {query && filteredItems.length === 0 && (
          <div className="command-palette-empty">No results found for "{query}"</div>
        )}
      </div>
    </div>
  );
}
