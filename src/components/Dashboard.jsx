import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, Star, Folder, File, ExternalLink } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard({ onSelectItem }) {
  const [recentItems, setRecentItems] = useState([]);
  const [pinnedLinks, setPinnedLinks] = useState([]);
  const [stats, setStats] = useState({ projects: 0, files: 0 });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (window.electronAPI) {
      const tree = await window.electronAPI.getTree();
      
      const allFiles = [];
      let projectCount = 0;
      
      const traverse = (nodes) => {
        for (const node of nodes) {
          if (node.isProject) projectCount++;
          if (node.type === 'file') allFiles.push(node);
          if (node.children) traverse(node.children);
        }
      };
      traverse(tree);

      // Sort files by id (since we don't have created_at mapped easily, we just take the last 5 in the array, assuming it's roughly insertion order)
      // Actually SQLite returns them in order, so the end of the array is newest.
      const reversedFiles = [...allFiles].reverse();
      
      setRecentItems(reversedFiles.filter(f => !f.name.endsWith('.link')).slice(0, 6));
      setPinnedLinks(reversedFiles.filter(f => f.name.endsWith('.link')).slice(0, 4));
      setStats({ projects: projectCount, files: allFiles.length });
    }
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-header">
        <h1>{getTimeGreeting()}, User</h1>
        <p>Welcome to your workspace. Here's what's happening today.</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon bg-blue"><Folder size={24} /></div>
          <div className="stat-info">
            <h3>{stats.projects}</h3>
            <span>Active Projects</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-purple"><File size={24} /></div>
          <div className="stat-info">
            <h3>{stats.files}</h3>
            <span>Total Documents</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <div className="section-header">
            <h2><Clock size={18} /> Recently Added</h2>
          </div>
          <div className="recent-list">
            {recentItems.length > 0 ? recentItems.map(item => (
              <div key={item.id} className="recent-card" onClick={() => onSelectItem(item)}>
                <File size={20} className="text-gray-400" />
                <div className="recent-info">
                  <h4>{item.name}</h4>
                  <span>Document</span>
                </div>
              </div>
            )) : (
              <div className="empty-state-sm">No recent documents found.</div>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2><Star size={18} /> Pinned Links</h2>
          </div>
          <div className="links-list">
            {pinnedLinks.length > 0 ? pinnedLinks.map(link => (
              <div key={link.id} className="link-card" onClick={() => onSelectItem(link)}>
                <ExternalLink size={16} />
                <div className="link-info">
                  <h4>{link.name.replace('.link', '')}</h4>
                  <span>{link.url}</span>
                </div>
              </div>
            )) : (
              <div className="empty-state-sm">No pinned links found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
