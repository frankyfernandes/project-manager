import React, { useState, useEffect, useRef } from 'react';
import { FileText, Image as ImageIcon, File, ExternalLink, HardDrive, Save, Info, X, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './Viewer.css';
import KanbanBoard from './KanbanBoard';

export default function Viewer({ openTabs, activeTabId, onSelectTab, onCloseTab, selectedItem }) {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [isTextFile, setIsTextFile] = useState(false);
  const [isCodeFile, setIsCodeFile] = useState(false);
  const [isWebLink, setIsWebLink] = useState(false);
  const [isImageFile, setIsImageFile] = useState(false);
  const [isPdfFile, setIsPdfFile] = useState(false);
  const [isBoardFile, setIsBoardFile] = useState(false);
  const [base64Data, setBase64Data] = useState(null);
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState('find');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const webviewRef = useRef(null);
  const textareaRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (selectedItem && selectedItem.type === 'file') {
      const matchText = selectedItem.name.match(/\.(txt|md|html|rtf)$/i);
      const matchCode = selectedItem.name.match(/\.(js|json|css|csv|jsx)$/i);
      const matchLink = selectedItem.name.match(/\.link$/i);
      const matchImage = selectedItem.name.match(/\.(png|jpe?g|gif|svg|webp)$/i);
      const matchPdf = selectedItem.name.match(/\.pdf$/i);
      const matchBoard = selectedItem.name.match(/\.(board|todo)$/i);
      
      setIsImageFile(!!matchImage);
      setIsPdfFile(!!matchPdf);

      if (matchText || matchCode || matchLink || matchImage || matchPdf || matchBoard) {
        if (window.electronAPI) {
          window.electronAPI.readFile(selectedItem.path).then(res => {
            if (matchLink) {
              setUrl(res.trim());
              setIsWebLink(true);
              setIsTextFile(false);
              setIsCodeFile(false);
            } else if (matchImage || matchPdf) {
              const mime = matchPdf ? 'application/pdf' : `image/${selectedItem.name.split('.').pop().toLowerCase()}`;
              setBase64Data(`data:${mime};base64,${res}`);
              setIsTextFile(false);
              setIsCodeFile(false);
              setIsWebLink(false);
            } else if (matchBoard) {
              setContent(res);
              setIsBoardFile(true);
              setIsTextFile(false);
              setIsCodeFile(false);
              setIsWebLink(false);
            } else {
              setContent(res);
              setIsTextFile(true);
              setIsCodeFile(!!matchCode);
              setIsWebLink(false);
              setIsBoardFile(false);
            }
          }).catch(err => {
            console.error(err);
            setIsTextFile(false);
            setIsWebLink(false);
            setBase64Data(null);
          });
        }
        setIsTextFile(false);
        setIsWebLink(false);
        setIsBoardFile(false);
        setContent('');
        setBase64Data(null);
      }
    } else {
      setIsTextFile(false);
      setIsWebLink(false);
      setIsImageFile(false);
      setIsPdfFile(false);
      setIsBoardFile(false);
      setContent('');
      setBase64Data(null);
    }
  }, [selectedItem]);

  const handleOpenSystem = () => {
    if (window.electronAPI) {
      window.electronAPI.openPath(selectedItem.path);
    } else {
      alert('File would open in system default application.');
    }
  };

  const handleSave = async () => {
    if (window.electronAPI) {
      await window.electronAPI.writeFile({ filePath: selectedItem.path, content });
      console.log('Saved');
    }
  };

  const handleBrowserAction = (action) => {
    if (!webviewRef.current) return;
    if (action === 'back' && webviewRef.current.canGoBack()) webviewRef.current.goBack();
    if (action === 'forward' && webviewRef.current.canGoForward()) webviewRef.current.goForward();
    if (action === 'refresh') webviewRef.current.reload();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (!isTextFile && !isCodeFile) return;
      
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault();
        setShowSearch(true);
        setSearchMode('find');
        setTimeout(() => {
          const searchInput = document.querySelector('.search-input');
          if (searchInput) searchInput.focus();
        }, 10);
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyH') {
        e.preventDefault();
        setShowSearch(true);
        setSearchMode('replace');
        setTimeout(() => {
          const replaceInput = document.querySelector('.replace-input');
          if (replaceInput) replaceInput.focus();
        }, 10);
      } else if (e.code === 'Escape' && showSearch) {
        e.preventDefault();
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTextFile, isCodeFile, showSearch, content, selectedItem]);

  useEffect(() => {
    if (!showSearch || !searchQuery) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    let textToSearch = '';
    if (isCodeFile) {
      textToSearch = content;
    } else if (isTextFile && quillRef.current) {
      const editor = quillRef.current.getEditor();
      if (editor) textToSearch = editor.getText();
    }

    if (!textToSearch) return;

    const lowerText = textToSearch.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const newMatches = [];
    let idx = lowerText.indexOf(lowerQuery);
    
    while (idx !== -1) {
      newMatches.push({ index: idx, length: searchQuery.length });
      idx = lowerText.indexOf(lowerQuery, idx + searchQuery.length);
    }
    
    setMatches(newMatches);
    // DO NOT auto-jump or reset index forcefully to 0 here to prevent focus stealing.
    // Only reset if out of bounds to keep UI counts accurate.
    if (newMatches.length === 0) {
      setCurrentMatchIndex(-1);
    } else if (currentMatchIndex >= newMatches.length) {
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, content, showSearch, isCodeFile, isTextFile]);

  const goToMatch = (index, matchesList = matches) => {
    if (matchesList.length === 0 || index < 0 || index >= matchesList.length) return;
    setCurrentMatchIndex(index);
    const match = matchesList[index];
    
    if (isCodeFile && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(match.index, match.index + match.length);
    } else if (isTextFile && quillRef.current) {
      const editor = quillRef.current.getEditor();
      if (editor) {
        editor.focus();
        editor.setSelection(match.index, match.length);
      }
    }
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = currentMatchIndex === -1 ? 0 : (currentMatchIndex + 1) % matches.length;
    goToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = currentMatchIndex === -1 ? matches.length - 1 : (currentMatchIndex - 1 + matches.length) % matches.length;
    goToMatch(prevIdx);
  };

  const handleReplace = () => {
    if (matches.length === 0 || currentMatchIndex < 0) return;
    const match = matches[currentMatchIndex];
    
    if (isCodeFile && textareaRef.current) {
      const newContent = content.substring(0, match.index) + replaceQuery + content.substring(match.index + match.length);
      setContent(newContent);
    } else if (isTextFile && quillRef.current) {
      const editor = quillRef.current.getEditor();
      editor.deleteText(match.index, match.length);
      editor.insertText(match.index, replaceQuery);
      setContent(editor.root.innerHTML);
    }
    
    // Automatically find the next match after replacement
    setTimeout(() => {
      // The content change will trigger a matches recalculation.
      // So we just refocus the replace input or search input.
      // We don't auto jump to next match index because matches will shrink.
    }, 0);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;
    
    if (isCodeFile) {
      let newContent = content;
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        newContent = newContent.substring(0, m.index) + replaceQuery + newContent.substring(m.index + m.length);
      }
      setContent(newContent);
    } else if (isTextFile && quillRef.current) {
      const editor = quillRef.current.getEditor();
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        editor.deleteText(m.index, m.length);
        editor.insertText(m.index, replaceQuery);
      }
      setContent(editor.root.innerHTML);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="viewer-container animate-fade-in">
      <div className="tab-bar">
        {openTabs?.map(tab => (
          <div 
            key={tab.id} 
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="tab-title">{tab.name}</span>
            <button className="tab-close" onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {!selectedItem ? (
        <div className="viewer-empty animate-fade-in">
          <div className="empty-state-icon">
            <HardDrive size={48} />
          </div>
          <h3>No file opened</h3>
          <p>Select a file from the explorer to open a new tab.</p>
        </div>
      ) : (
        <div className="viewer-content-wrapper" style={{ padding: isWebLink ? 0 : 24 }}>
          {!isWebLink && (
            <div className="viewer-header">
              <div className="header-left">
                <div className="header-icon">
                  {selectedItem.type === 'folder' ? <FolderIcon /> : <FileIcon name={selectedItem.name} url={url} />}
                </div>
                <div className="header-info">
                  <h2>{selectedItem.name}</h2>
                  <span className="type-badge">
                    {selectedItem.type === 'folder' ? (selectedItem.isProject ? 'Project Folder' : 'Folder') : (isBoardFile ? 'Kanban Board' : 'Document')}
                  </span>
                </div>
              </div>

              <div className="header-actions">
                <button 
                  className="icon-action-btn" 
                  title={`Path: ${selectedItem.path}\nType: ${selectedItem.type}`}
                >
                  <Info size={20} />
                </button>
                <button 
                  className="icon-action-btn" 
                  title={'Open in External Application'} 
                  onClick={handleOpenSystem}
                >
                  <ExternalLink size={20} />
                </button>
              </div>
            </div>
          )}

          <div className="viewer-content">
            {isWebLink && url ? (
              <div className="editor-card animate-fade-in" style={{ borderRadius: 0, border: 'none' }}>
                <div className="browser-header">
                  <button className="browser-btn" onClick={() => handleBrowserAction('back')}><ArrowLeft size={16} /></button>
                  <button className="browser-btn" onClick={() => handleBrowserAction('forward')}><ArrowRight size={16} /></button>
                  <button className="browser-btn" onClick={() => handleBrowserAction('refresh')} title="Refresh"><RefreshCw size={16} /></button>
                  <div className="browser-url">{url}</div>
                  <button className="browser-btn" title={`Path: ${selectedItem.path}\nType: ${selectedItem.type}`}><Info size={16} /></button>
                  <button className="browser-btn" title={'Open in External Browser'} onClick={handleOpenSystem}><ExternalLink size={16} /></button>
                </div>
                <webview 
                  ref={webviewRef}
                  src={url} 
                  className="embedded-webview"
                  allowpopups="true"
                  partition={localStorage.getItem('persistWebSession') === 'false' ? 'temp_session' : 'persist:browser'}
                ></webview>
              </div>
            ) : isImageFile && base64Data ? (
              <div className="editor-card animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', border: 'none', padding: '24px' }}>
                <img src={base64Data} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} alt={selectedItem.name} />
              </div>
            ) : isPdfFile && base64Data ? (
              <div className="editor-card animate-fade-in" style={{ border: 'none', background: 'transparent', display: 'flex', flex: 1 }}>
                <iframe src={base64Data} style={{ flex: 1, width: '100%', height: '100%', border: 'none', borderRadius: '12px', backgroundColor: 'white' }}></iframe>
              </div>
            ) : isTextFile ? (
              <div className="editor-card animate-fade-in" style={{ position: 'relative' }}>
                <div className="editor-header">
                  <h3>{isCodeFile ? 'Code Editor' : 'Rich Text Editor'}</h3>
                  <button className="primary-btn sm-btn" onClick={handleSave}>
                    <Save size={16} /> Save Changes
                  </button>
                </div>
                
                {showSearch && (
                  <div className="search-replace-toolbar animate-fade-in">
                    <div className="search-row">
                      <input 
                        type="text" 
                        placeholder="Find..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { 
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleNextMatch(); 
                          }
                        }}
                        autoFocus
                        className="search-input"
                      />
                      <span className="search-counts">
                        {matches.length > 0 ? `${currentMatchIndex + 1} / ${matches.length}` : '0 / 0'}
                      </span>
                      <button onClick={handlePrevMatch} className="search-nav-btn">&uarr;</button>
                      <button onClick={handleNextMatch} className="search-nav-btn">&darr;</button>
                      <button onClick={() => setShowSearch(false)} className="search-close-btn"><X size={14} /></button>
                    </div>
                    {searchMode === 'replace' && (
                      <div className="replace-row">
                        <input 
                          type="text" 
                          placeholder="Replace with..." 
                          value={replaceQuery}
                          onChange={e => setReplaceQuery(e.target.value)}
                          onKeyDown={e => { 
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleReplace(); 
                            }
                          }}
                          className="replace-input"
                        />
                        <button onClick={handleReplace} className="replace-btn">Replace</button>
                        <button onClick={handleReplaceAll} className="replace-btn">All</button>
                      </div>
                    )}
                  </div>
                )}

                {isCodeFile ? (
                  <textarea 
                    ref={textareaRef}
                    className="text-editor" 
                    value={content} 
                    onChange={e => setContent(e.target.value)}
                    spellCheck="false"
                  />
                ) : (
                  <ReactQuill 
                    ref={quillRef}
                    theme="snow"
                    className="rich-text-editor"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    placeholder="Start writing..."
                  />
                )}
              </div>
            ) : isBoardFile ? (
              <div className="editor-card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                <KanbanBoard 
                  initialData={content} 
                  onSave={(newData) => {
                    setContent(newData);
                    if (window.electronAPI) {
                      window.electronAPI.writeFile({ filePath: selectedItem.path, content: newData });
                    }
                  }} 
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers for icons
const FolderIcon = () => (
  <div className="large-icon-bg bg-blue">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
  </div>
);

const FileIcon = ({ name, url }) => {
  if (name.endsWith('.link') && url) {
    try {
      const hostname = new URL(url).hostname;
      return (
        <div className="large-icon-bg bg-gray" style={{ background: 'transparent' }}>
          <img 
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`} 
            alt="favicon" 
            style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain' }} 
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
          />
          <FileText size={32} style={{ display: 'none' }} />
        </div>
      );
    } catch(e) {}
  }
  
  if (name.endsWith('.png') || name.endsWith('.jpg')) {
    return (
      <div className="large-icon-bg bg-purple">
        <ImageIcon size={32} />
      </div>
    );
  }
  return (
    <div className="large-icon-bg bg-gray">
      <FileText size={32} />
    </div>
  );
};
