import React, { useState } from 'react';
import Explorer from './components/Explorer';
import Viewer from './components/Viewer';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import Dashboard from './components/Dashboard';
import Timer from './components/Timer';

function App() {
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  return (
    <div className="app-container">
      <div className="explorer-pane">
        <Explorer onSelect={handleSelectItem} selectedItem={activeTab} />
      </div>
      <div className="viewer-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        onSelect={handleSelectItem} 
      />
      <Timer selectedItem={activeTab} />
    </div>
  );
}

export default App;
