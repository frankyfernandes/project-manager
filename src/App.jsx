import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Explorer from './components/Explorer';
import Viewer from './components/Viewer';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import Dashboard from './components/Dashboard';
import Timer from './components/Timer';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [enableTimeTracker, setEnableTimeTracker] = useState(true);

  React.useEffect(() => {
    // Load initial preferences
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
    const savedFontSize = localStorage.getItem('editorFontSize');
    if (savedFontSize) {
      document.documentElement.style.setProperty('--editor-font-size', savedFontSize);
    }
    
    const savedUser = localStorage.getItem('userProfile');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }

    const savedTimeTracker = localStorage.getItem('enableTimeTracker');
    if (savedTimeTracker !== null) {
      setEnableTimeTracker(savedTimeTracker === 'true');
    }

    if (window.electronAPI) {
      window.electronAPI.onOpenSettings(() => {
        setIsSettingsOpen(true);
      });
      window.electronAPI.onOpenCommandPalette(() => {
        setIsCommandPaletteOpen(true);
      });
    }

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
        e.preventDefault();
        console.log('Ctrl+P pressed, opening Command Palette');
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectItem = (item) => {
    // Only open files as tabs. Folders are just expanded in Explorer.
    if (item.type === 'folder') return;

    if (!openTabs.find(tab => tab.id === item.id)) {
      setOpenTabs([...openTabs, item]);
    }
    setActiveTabId(item.id);
  };

  const handleCloseTab = (id) => {
    const newTabs = openTabs.filter(tab => tab.id !== id);
    setOpenTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userProfile');
    setUser(null);
  };

  const handleShowMenu = (type, e) => {
    if (window.electronAPI) {
      const rect = e.currentTarget.getBoundingClientRect();
      window.electronAPI.showMenu(type, rect.left, rect.bottom);
    }
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <div className="title-bar" style={{ 
        height: '40px', 
        minHeight: '40px',
        WebkitAppRegion: 'drag', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 150px 0 16px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', WebkitAppRegion: 'no-drag' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'drag' }}>
            <div 
              style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Sidebar"
            >
              <Menu size={16} style={{ color: 'var(--text-primary)' }} />
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', paddingRight: '8px' }}>
              Project Manager
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span style={{ cursor: 'pointer', padding: '4px' }} onClick={(e) => handleShowMenu('file', e)}>File</span>
            <span style={{ cursor: 'pointer', padding: '4px' }} onClick={(e) => handleShowMenu('edit', e)}>Edit</span>
            <span style={{ cursor: 'pointer', padding: '4px' }} onClick={(e) => handleShowMenu('view', e)}>View</span>
          </div>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={user.picture} 
            alt="Profile" 
            style={{ width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', border: '1px solid var(--border-color)' }} 
            onClick={() => setIsSettingsOpen(true)}
            title="Settings & Account"
          />
        </div>
      </div>

      <div className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="explorer-pane" style={{ display: isSidebarOpen ? 'flex' : 'none' }}>
          <Explorer onSelect={handleSelectItem} selectedItem={activeTab} />
        </div>
        <div className="viewer-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
          {openTabs.length > 0 ? (
            <Viewer 
              openTabs={openTabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              selectedItem={activeTab} 
            />
          ) : (
            <Dashboard onSelectItem={handleSelectItem} />
          )}
        </div>
      </div>
      {isSettingsOpen && (
        <Settings 
          onClose={() => setIsSettingsOpen(false)} 
          user={user} 
          onLogout={handleLogout}
          enableTimeTracker={enableTimeTracker}
          setEnableTimeTracker={setEnableTimeTracker}
        />
      )}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        onSelect={handleSelectItem} 
      />
      {enableTimeTracker && <Timer selectedItem={activeTab} />}
    </div>
  );
}

export default App;
