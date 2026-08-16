import React, { useState, useEffect } from 'react';
import { Search, FolderPlus, Folder, File, ChevronRight, ChevronDown, Plus, X, Trash2, Upload } from 'lucide-react';
import './Explorer.css';

const TreeItem = ({ item, level, onSelect, selectedItem, onAddFolder, onAddFile, onUpload, onDelete, requestPrompt, requestConfirm }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedItem?.id === item.id;
  
  const handleToggle = (e) => {
    e.stopPropagation();
    if (item.type === 'folder') {
      setIsOpen(!isOpen);
    }
    onSelect(item);
  };

  const handleAddFolder = (e) => {
    e.stopPropagation();
    requestPrompt('Folder Name:', 'New Folder', (name) => {
      onAddFolder(name, item);
      setIsOpen(true);
    });
  };

  const handleAddFile = (extension) => {
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
      >
        <span className="tree-icon-container">
          {item.type === 'folder' && (
            isOpen ? <ChevronDown size={14} className="tree-chevron" /> : <ChevronRight size={14} className="tree-chevron" />
          )}
          {item.type === 'folder' ? (
            <Folder size={16} className="tree-icon text-blue-400" />
          ) : (
            item.name.endsWith('.link') && item.url ? (
              <img 
                src={`https://www.google.com/s2/favicons?domain=${(function(){ try { return new URL(item.url).hostname; } catch(e) { return ''; } })()}&sz=32`}
                style={{ width: 16, height: 16, objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
            ) : null
          )}
          {item.type !== 'folder' && (
            <File size={16} className="tree-icon text-gray-400" style={{ display: (item.name.endsWith('.link') && item.url) ? 'none' : 'block' }} />
          )}
        </span>
        <span className="tree-label">{item.name}</span>
        
        <div className="tree-actions">
          {item.type === 'folder' && (
            <>
              <button onClick={handleAddFolder} title="Add Folder"><FolderPlus size={14} /></button>
              <div className="add-file-wrapper">
                <button title="Add File"><Plus size={14} /></button>
                <div className="file-format-menu">
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.link'); }}>Web Link (.link)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.html'); }}>Rich Text (.html)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.md'); }}>Markdown (.md)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.txt'); }}>Raw Text (.txt)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.js'); }}>Javascript (.js)</div>
                  <div className="format-item" onClick={(e) => { e.stopPropagation(); handleAddFile('.css'); }}>CSS (.css)</div>
                </div>
              </div>
              <button onClick={handleUpload} title="Upload Files"><Upload size={14} /></button>
            </>
          )}
          <button onClick={handleDelete} title="Delete" className="delete-btn"><Trash2 size={14} /></button>
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
