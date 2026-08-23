import React, { useState, useEffect } from 'react';
import { Search, FolderPlus, Folder, File, ChevronRight, ChevronDown, Plus, X, Trash2, Upload, Kanban, Link, FileText, FileCode, FileType, Table2, FileBadge } from 'lucide-react';
import './Explorer.css';

const TreeItem = ({ item, level, onSelect, selectedItem, onAddFolder, onAddFile, onUpload, onDelete, onRename, onMove, requestPrompt, requestConfirm }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const isSelected = selectedItem?.id === item.id;
  
  const handleToggle = (e) => {
    e.stopPropagation();
    if (isEditing) return;
    if (item.type === 'folder') {
      setIsOpen(!isOpen);
    }
    onSelect(item);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (item.type === 'file') {
      setIsEditing(true);
      setEditName(item.name);
    }
  };

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== item.name) {
      onRename(item, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDragStart = (e) => {
    if (item.type === 'file') {
      e.dataTransfer.setData('application/json', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e) => {
    if (item.type === 'folder') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.type === 'folder') {
      try {
        const draggedItem = JSON.parse(e.dataTransfer.getData('application/json'));
        if (draggedItem.id !== item.id) {
          onMove(draggedItem, item);
        }
      } catch (err) {}
    }
  };

  const handleAddFolder = (e) => {
    e.stopPropagation();
    requestPrompt('Folder Name:', 'New Folder', (name) => {
      onAddFolder(name, item);
      setIsOpen(true);
    });
  };

  const handleAddFile = (extension) => {
    if (extension === '.gsheet' || extension === '.gdoc') {
      const typeStr = extension === '.gsheet' ? 'Google Sheet' : 'Google Doc';
      const typeEnum = extension === '.gsheet' ? 'sheet' : 'doc';
      requestPrompt(`${typeStr} Name:`, `Untitled Document`, async (name) => {
        try {
          // Show a temporary loading or let it take time
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
          
          let projectName = item.isProject ? item.name : 'Project Manager Default';
          // Find the actual project root if this is a nested folder
          if (!item.isProject && item.project_id) {
            // we don't have direct access to project name here easily, 
            // but we can pass 'Project Manager' or ask the user, or pass the parent folder name.
            // For simplicity, let's just use the item's name or a default.
            projectName = item.name; 
          }

          const webViewLink = await window.electronAPI.createGoogleFile({
            type: typeEnum,
            projectName,
            fileName: name,
            clientId,
            clientSecret
          });

          // Once we have the URL, create a local .link file
          let finalName = name;
          if (!finalName.endsWith('.link')) finalName += '.link';
          onAddFile(finalName, item, webViewLink);
          setIsOpen(true);
        } catch (e) {
          alert('Failed to create Google file: ' + e.message);
        }
      });
      return;
    }

    if (extension === '.link') {
      requestPrompt(`Add Web Link`, `Web Link`, (name, url) => {
        let finalName = name;
        if (!finalName.endsWith('.link')) finalName += '.link';
        onAddFile(finalName, item, url);
        setIsOpen(true);
      }, true);
      return;
    }

    requestPrompt(`File Name:`, `new_document${extension}`, (name) => {
      let finalName = name;
      if (!finalName.endsWith(extension)) {
         if (!finalName.includes('.')) {
             finalName += extension;
         }
      }
      onAddFile(finalName, item);
      setIsOpen(true);
    });
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    const msg = item.type === 'folder' 
      ? `Are you sure you want to delete "${item.name}" and all its contents? This cannot be undone.`
      : `Are you sure you want to delete "${item.name}"? This cannot be undone.`;
      
    requestConfirm('Confirm Deletion', msg, () => {
      onDelete(item);
    });
  };

  const handleUpload = (e) => {
    e.stopPropagation();
    onUpload(item);
  };

  return (
    <div>
      <div 
        className={`tree-item ${isSelected ? 'selected' : ''}`} 
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleToggle}
        onDoubleClick={handleDoubleClick}
        draggable={item.type === 'file'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <span className="tree-icon-container">
          {item.type === 'folder' && (
            isOpen ? <ChevronDown size={14} className="tree-chevron" /> : <ChevronRight size={14} className="tree-chevron" />
          )}
          {item.type === 'folder' ? (
            <Folder size={16} className="tree-icon text-blue-400" />
          ) : item.name.endsWith('.board') ? (
            <Kanban size={16} className="tree-icon" style={{ color: '#a855f7' }} />
          ) : (
            <>
              {item.name.endsWith('.link') && item.url && (
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${(function(){ try { return new URL(item.url).hostname; } catch(e) { return ''; } })()}&sz=32`}
                  style={{ width: 16, height: 16, objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
              )}
              <File size={16} className="tree-icon text-gray-400" style={{ display: (item.name.endsWith('.link') && item.url) ? 'none' : 'block' }} />
            </>
          )}
        </span>
        {isEditing ? (
          <input 
            type="text" 
            className="tree-rename-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') {
                setIsEditing(false);
                setEditName(item.name);
              }
            }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="tree-label">{item.name}</span>
        )}
        
        <div className="tree-actions">
          {item.type === 'folder' && (
            <>
              <button onClick={handleAddFolder} title="Add Folder"><FolderPlus size={14} /></button>
              <div className="add-file-wrapper">
                <button title="Add File"><Plus size={14} /></button>
                <div className="file-format-menu">
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.board'); }}><Kanban size={14} style={{ marginRight: 8, color: '#a855f7' }} /> Kanban Board (.board)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.gsheet'); }}><Table2 size={14} style={{ marginRight: 8, color: '#10b981' }} /> Google Sheet</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.gdoc'); }}><FileBadge size={14} style={{ marginRight: 8, color: '#3b82f6' }} /> Google Doc</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.link'); }}><Link size={14} style={{ marginRight: 8, color: '#3b82f6' }} /> Web Link (.link)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.html'); }}><FileText size={14} style={{ marginRight: 8, color: '#f59e0b' }} /> Rich Text (.html)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.md'); }}><FileType size={14} style={{ marginRight: 8, color: '#10b981' }} /> Markdown (.md)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.txt'); }}><File size={14} style={{ marginRight: 8, color: '#9ca3af' }} /> Raw Text (.txt)</div>
                  {/* <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.js'); }}><FileCode size={14} style={{ marginRight: 8, color: '#eab308' }} /> Javascript (.js)</div> */}
                  {/* <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.css'); }}><FileCode size={14} style={{ marginRight: 8, color: '#38bdf8' }} /> CSS (.css)</div> */}
                </div>
              </div>
              <button onClick={handleUpload} title="Upload Files"><Upload size={14} /></button>
            </>
          )}
          {!item.is_default && (
            <button onClick={handleDelete} title="Delete" className="delete-btn"><Trash2 size={14} /></button>
          )}
        </div>
      </div>
      
      {item.type === 'folder' && isOpen && item.children && (
        <div className="tree-children">
          {item.children.map(child => (
            <TreeItem 
              key={child.id} 
              item={child} 
              level={level + 1} 
              onSelect={onSelect}
              selectedItem={selectedItem}
              onAddFolder={onAddFolder}
              onAddFile={onAddFile}
              onUpload={onUpload}
              onDelete={onDelete}
              onRename={onRename}
              onMove={onMove}
              requestPrompt={requestPrompt}
              requestConfirm={requestConfirm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Explorer({ onSelect, selectedItem }) {
  const [search, setSearch] = useState('');
  const [treeData, setTreeData] = useState([]);
  
  // Custom Prompt Modal State
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', value: '', secondaryValue: '', isDouble: false, onSubmit: null });
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const requestPrompt = (title, defaultValue, onSubmit, isDouble = false) => {
    setPromptConfig({ isOpen: true, title, value: defaultValue, secondaryValue: 'https://', isDouble, onSubmit });
  };

  const requestConfirm = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  const handlePromptSubmit = (e) => {
    e.preventDefault();
    if (promptConfig.value.trim() && promptConfig.onSubmit) {
      promptConfig.onSubmit(promptConfig.value.trim(), promptConfig.secondaryValue.trim());
    }
    setPromptConfig({ isOpen: false, title: '', value: '', secondaryValue: '', isDouble: false, onSubmit: null });
  };

  const closePrompt = () => {
    setPromptConfig({ isOpen: false, title: '', value: '', secondaryValue: '', isDouble: false, onSubmit: null });
  };

  const loadTree = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getTree();
      setTreeData(data);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleAddProject = () => {
    requestPrompt('Project Name:', 'New Project', async (name) => {
      if (window.electronAPI) {
        await window.electronAPI.createProject(name);
        loadTree();
      }
    });
  };

  const handleAddFolder = async (name, parent) => {
    if (window.electronAPI) {
      const projectId = parent.isProject ? parent.id : parent.project_id;
      await window.electronAPI.createFolder({
        name,
        projectId,
        parentId: parent.isProject ? null : parent.id,
        parentPath: parent.path
      });
      loadTree();
    }
  };

  const handleAddFile = async (name, parent, url = '') => {
    if (window.electronAPI) {
      const projectId = parent.isProject ? parent.id : parent.project_id;
      const newFile = await window.electronAPI.createFile({
        name,
        projectId,
        folderId: parent.isProject ? null : parent.id,
        parentPath: parent.path
      });
      if (url && name.endsWith('.link')) {
        await window.electronAPI.writeFile({ filePath: newFile.path, content: url });
      }
      loadTree();
    }
  };

  const handleUploadFile = async (parent) => {
    if (window.electronAPI) {
      const projectId = parent.isProject ? parent.id : parent.project_id;
      const res = await window.electronAPI.uploadFiles({
        projectId,
        folderId: parent.isProject ? null : parent.id,
        parentPath: parent.path
      });
      if (res) loadTree();
    }
  };

  const handleDeleteItem = async (item) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteItem(item);
      loadTree();
    }
  };

  const handleRenameFile = async (item, newName) => {
    if (window.electronAPI) {
      await window.electronAPI.renameFile({ id: item.id, oldPath: item.path, newName });
      loadTree();
    }
  };

  const handleMoveFile = async (item, targetFolder) => {
    if (window.electronAPI) {
      const newFolderId = targetFolder.isProject ? null : targetFolder.id;
      const newParentPath = targetFolder.path;
      await window.electronAPI.moveFile({ id: item.id, oldPath: item.path, newFolderId, newParentPath });
      loadTree();
    }
  };

  const filteredTree = search 
    ? treeData.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : treeData;

  return (
    <div className="explorer-container">
      <div className="explorer-header">
        <h2>Projects</h2>
        <button className="add-btn" onClick={handleAddProject} title="Add New Project">
          <FolderPlus size={18} />
        </button>
      </div>
      
      <div className="explorer-search">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="explorer-tree">
        {filteredTree.map(item => (
          <TreeItem 
            key={item.id} 
            item={item} 
            level={0} 
            onSelect={onSelect}
            selectedItem={selectedItem}
            onAddFolder={handleAddFolder}
            onAddFile={handleAddFile}
            onUpload={handleUploadFile}
            onDelete={handleDeleteItem}
            onRename={handleRenameFile}
            onMove={handleMoveFile}
            requestPrompt={requestPrompt}
            requestConfirm={requestConfirm}
          />
        ))}
      </div>

      {promptConfig.isOpen && (
        <div className="prompt-overlay">
          <div className="prompt-modal animate-fade-in">
            <div className="prompt-header">
              <h3>{promptConfig.title}</h3>
              <button onClick={closePrompt} className="close-btn"><X size={16} /></button>
            </div>
            <form onSubmit={handlePromptSubmit}>
              <div style={{ marginBottom: promptConfig.isDouble ? '12px' : '0' }}>
                {promptConfig.isDouble && <label style={{ display:'block', fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'4px' }}>Name:</label>}
                <input 
                  type="text" 
                  autoFocus
                  value={promptConfig.value} 
                  onChange={e => setPromptConfig({...promptConfig, value: e.target.value})}
                />
              </div>
              {promptConfig.isDouble && (
                <div>
                  <label style={{ display:'block', fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'4px' }}>Target URL:</label>
                  <input 
                    type="url" 
                    value={promptConfig.secondaryValue} 
                    onChange={e => setPromptConfig({...promptConfig, secondaryValue: e.target.value})}
                  />
                </div>
              )}
              <div className="prompt-actions">
                <button type="button" onClick={closePrompt} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-submit">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmConfig.isOpen && (
        <div className="prompt-overlay">
          <div className="prompt-modal animate-fade-in">
            <div className="prompt-header">
              <h3>{confirmConfig.title}</h3>
              <button onClick={() => setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null })} className="close-btn"><X size={16} /></button>
            </div>
            <div style={{ padding: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {confirmConfig.message}
            </div>
            <div className="prompt-actions">
              <button type="button" onClick={() => setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null })} className="btn-cancel">Cancel</button>
              <button 
                type="button" 
                onClick={() => { 
                  if(confirmConfig.onConfirm) confirmConfig.onConfirm(); 
                  setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null }); 
                }} 
                className="btn-submit" 
                style={{ backgroundColor: '#ef4444' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
