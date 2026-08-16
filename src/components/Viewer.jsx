import React, { useState, useEffect, useRef } from 'react';
import { FileText, Image as ImageIcon, File, ExternalLink, HardDrive, Save, Info, X, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './Viewer.css';

export default function Viewer({ openTabs, activeTabId, onSelectTab, onCloseTab, selectedItem }) {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [isTextFile, setIsTextFile] = useState(false);
  const [isCodeFile, setIsCodeFile] = useState(false);
  const [isWebLink, setIsWebLink] = useState(false);
  const [isImageFile, setIsImageFile] = useState(false);
  const [isPdfFile, setIsPdfFile] = useState(false);
  const [base64Data, setBase64Data] = useState(null);
  const webviewRef = useRef(null);

  useEffect(() => {
    if (selectedItem && selectedItem.type === 'file') {
      const matchText = selectedItem.name.match(/\.(txt|md|html|rtf)$/i);
      const matchCode = selectedItem.name.match(/\.(js|json|css|csv|jsx)$/i);
      const matchLink = selectedItem.name.match(/\.link$/i);
      const matchImage = selectedItem.name.match(/\.(png|jpe?g|gif|svg|webp)$/i);
      const matchPdf = selectedItem.name.match(/\.pdf$/i);
      
      setIsImageFile(!!matchImage);
      setIsPdfFile(!!matchPdf);

      if (matchText || matchCode || matchLink || matchImage || matchPdf) {
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
            } else {
              setContent(res);
              setIsTextFile(true);
              setIsCodeFile(!!matchCode);
              setIsWebLink(false);
            }
          }).catch(err => {
            console.error(err);
            setIsTextFile(false);
            setIsWebLink(false);
            setBase64Data(null);
          });
        }
      } else {
        setIsTextFile(false);
        setIsWebLink(false);
        setContent('');
        setBase64Data(null);
      }
    } else {
      setIsTextFile(false);
      setIsWebLink(false);
      setIsImageFile(false);
      setIsPdfFile(false);
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
        <div className="viewer-content-wrapper">
          <div className="viewer-header">
            <div className="header-left">
              <div className="header-icon">
                {selectedItem.type === 'folder' ? <FolderIcon /> : <FileIcon name={selectedItem.name} url={url} />}
              </div>
              <div className="header-info">
                <h2>{selectedItem.name}</h2>
                <span className="type-badge">
                  {selectedItem.type === 'folder' ? (selectedItem.isProject ? 'Project Folder' : 'Folder') : (isWebLink ? 'Web Link' : 'Document')}
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

          <div className="viewer-content">
            {isWebLink && url ? (
              <div className="editor-card animate-fade-in">
                <div className="browser-header">
                  <button className="browser-btn" onClick={() => handleBrowserAction('back')}><ArrowLeft size={16} /></button>
                  <button className="browser-btn" onClick={() => handleBrowserAction('forward')}><ArrowRight size={16} /></button>
                  <button className="browser-btn" onClick={() => handleBrowserAction('refresh')}><RefreshCw size={16} /></button>
                  <div className="browser-url">{url}</div>
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
              <div className="editor-card animate-fade-in">
                <div className="editor-header">
                  <h3>{isCodeFile ? 'Code Editor' : 'Rich Text Editor'}</h3>
                  <button className="primary-btn sm-btn" onClick={handleSave}>
                    <Save size={16} /> Save Changes
                  </button>
                </div>
                
                {isCodeFile ? (
                  <textarea 
                    className="text-editor" 
                    value={content} 
                    onChange={e => setContent(e.target.value)}
                    spellCheck="false"
                  />
                ) : (
                  <ReactQuill 
                    theme="snow"
                    className="rich-text-editor"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    placeholder="Start writing..."
                  />
                )}
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
