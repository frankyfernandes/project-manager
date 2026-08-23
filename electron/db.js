import sqlite3 from 'sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Database is stored in Documents folder by default
const docsPath = app.getPath('documents');
const appFolder = path.join(docsPath, 'ProjectManagerApp');

if (!fs.existsSync(appFolder)) {
  fs.mkdirSync(appFolder);
}

const dbPath = path.join(appFolder, 'project_manager.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Database connected at', dbPath);
    initializeDb();
  }
});

function initializeDb() {
  db.serialize(() => {
    // Projects table
    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT,
      icon_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Folders table
    db.run(`CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      parent_id TEXT,
      name TEXT NOT NULL,
      path TEXT,
      icon_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    )`);

    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      folder_id TEXT,
      name TEXT NOT NULL,
      type TEXT,
      path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )`);

    // Time Logs table
    db.run(`CREATE TABLE IF NOT EXISTS time_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      duration_seconds INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    )`);

    // Migrations
    db.all("PRAGMA table_info(projects)", (err, rows) => {
      if (!err && rows && !rows.some(r => r.name === 'path')) {
          db.run("ALTER TABLE projects ADD COLUMN path TEXT");
      }
    });
    db.all("PRAGMA table_info(folders)", (err, rows) => {
      if (!err && rows && !rows.some(r => r.name === 'path')) {
          db.run("ALTER TABLE folders ADD COLUMN path TEXT");
      }
    });
    db.all("PRAGMA table_info(files)", (err, rows) => {
      if (!err && rows) {
        if (!rows.some(r => r.name === 'path')) {
          db.run("ALTER TABLE files ADD COLUMN path TEXT");
        }
        if (!rows.some(r => r.name === 'is_default')) {
          db.run("ALTER TABLE files ADD COLUMN is_default BOOLEAN DEFAULT 0");
        }
      }
    });
  });
}
