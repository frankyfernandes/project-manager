import React, { useState } from 'react';
import Explorer from './components/Explorer';
import Viewer from './components/Viewer';
import Settings from './components/Settings';

function App() {
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  React.useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onOpenSettings(() => {
        setIsSettingsOpen(true);
      });
    }
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
        <Viewer 
          openTabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          selectedItem={activeTab} 
        />
      </div>
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}

export default App;
