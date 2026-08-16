import React, { useState, useEffect } from 'react';
import './Settings.css';

const Settings = ({ onClose }) => {
  const [persistSession, setPersistSession] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [fontSize, setFontSize] = useState('14px');

  useEffect(() => {
    const savedSession = localStorage.getItem('persistWebSession');
    if (savedSession !== null) {
      setPersistSession(savedSession === 'true');
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    const savedFontSize = localStorage.getItem('editorFontSize') || '14px';
    setFontSize(savedFontSize);
  }, []);

  const handleToggleSession = () => {
    const newValue = !persistSession;
    setPersistSession(newValue);
    localStorage.setItem('persistWebSession', newValue);
  };

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  const handleFontSizeChange = (e) => {
    const newSize = e.target.value;
    setFontSize(newSize);
    localStorage.setItem('editorFontSize', newSize);
    document.documentElement.style.setProperty('--editor-font-size', newSize);
  };

  return (
    <div className="settings-overlay">
      <div className="settings-modal animate-fade-in">
        <div className="settings-header">
          <h2>Preferences</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="settings-content">
          
          <div className="setting-group">
            <h3>Appearance</h3>
            
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Theme</span>
                <span className="setting-desc">Switch between dark and light aesthetics.</span>
              </div>
              <select value={theme} onChange={handleThemeChange} className="setting-select">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Editor Font Size</span>
                <span className="setting-desc">Base font size for text and code editors.</span>
              </div>
              <select value={fontSize} onChange={handleFontSizeChange} className="setting-select">
                <option value="12px">Small (12px)</option>
                <option value="14px">Medium (14px)</option>
                <option value="16px">Large (16px)</option>
                <option value="18px">Extra Large (18px)</option>
              </select>
            </div>
          </div>

          <div className="setting-group">
            <h3>Browser Integration</h3>
            
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Persistent Web Sessions</span>
                <span className="setting-desc">Save cookies and login sessions for external web links across app restarts.</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={persistSession} onChange={handleToggleSession} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
