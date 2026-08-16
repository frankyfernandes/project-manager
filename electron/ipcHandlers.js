import { ipcMain, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import crypto from 'crypto';

const docsPath = app.getPath('documents');
const appFolder = path.join(docsPath, 'ProjectManagerApp', 'Projects');

if (!fs.existsSync(appFolder)) {
  fs.mkdirSync(appFolder, { recursive: true });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function registerIpcHandlers() {
  ipcMain.handle('get-tree', async () => {
    try {
      const projects = await getQuery('SELECT * FROM projects');
      const folders = await getQuery('SELECT * FROM folders');
      const files = await getQuery('SELECT * FROM files');

      // Build the tree
      const tree = projects.map(p => ({
        ...p,
        type: 'folder',
        isProject: true,
        children: []
      }));

      // Helper to find parent
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      // Attach folders
      folders.forEach(f => {
        const parent = findNode(tree, f.parent_id || f.project_id);
        if (parent) {
          parent.children.push({ ...f, type: 'folder', children: [] });
        }
      });

      // Attach files
      files.forEach(f => {
        const parent = findNode(tree, f.folder_id || f.project_id);
        if (parent) {
          let extra = {};
          if (f.name.endsWith('.link')) {
            try {
              if (fs.existsSync(f.path)) {
                extra.url = fs.readFileSync(f.path, 'utf-8').trim();
              }
            } catch (e) {}
          }
          parent.children.push({ ...f, type: 'file', ...extra });
        }
      });

      return tree;
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  ipcMain.handle('create-project', async (event, name) => {
    const id = crypto.randomUUID();
    const projectPath = path.join(appFolder, name);
    
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    await runQuery(`INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`, [id, name, projectPath]);
    return { id, name, path: projectPath, type: 'folder', isProject: true, children: [] };
  });

  ipcMain.handle('create-folder', async (event, { name, projectId, parentId, parentPath }) => {
    const id = crypto.randomUUID();
    const folderPath = path.join(parentPath, name);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    await runQuery(`INSERT INTO folders (id, project_id, parent_id, name, path) VALUES (?, ?, ?, ?, ?)`, 
      [id, projectId, parentId, name, folderPath]);
    return { id, name, path: folderPath, type: 'folder', children: [] };
  });

  ipcMain.handle('create-file', async (event, { name, projectId, folderId, parentPath }) => {
    const id = crypto.randomUUID();
    const filePath = path.join(parentPath, name);
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, ''); // Create empty file
    }

    await runQuery(`INSERT INTO files (id, project_id, folder_id, name, type, path) VALUES (?, ?, ?, ?, ?, ?)`, 
      [id, projectId, folderId, name, 'file', filePath]);
    return { id, name, path: filePath, type: 'file' };
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      if (filePath.endsWith('.pdf') || filePath.match(/\.(png|jpe?g|gif|svg|webp)$/i)) {
        return fs.readFileSync(filePath, 'base64');
      }
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('write-file', async (event, { filePath, content }) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('upload-files', async (event, { projectId, folderId, parentPath }) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Files to Upload',
        properties: ['openFile', 'multiSelections']
      });

      if (canceled || filePaths.length === 0) {
        return null;
      }

      const uploadedFiles = [];
      for (const srcPath of filePaths) {
        const fileName = path.basename(srcPath);
        const destPath = path.join(parentPath, fileName);
        
        fs.copyFileSync(srcPath, destPath);

        const existing = await getQuery('SELECT id FROM files WHERE path = ?', [destPath]);
        
        if (existing.length === 0) {
          const id = crypto.randomUUID();
          await runQuery(`INSERT INTO files (id, project_id, folder_id, name, type, path) VALUES (?, ?, ?, ?, ?, ?)`, 
            [id, projectId, folderId, fileName, 'file', destPath]);
          uploadedFiles.push({ id, name: fileName, path: destPath, type: 'file' });
        }
      }
      return uploadedFiles;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('delete-item', async (event, item) => {
    try {
      // 1. Delete from disk
      if (fs.existsSync(item.path)) {
        fs.rmSync(item.path, { recursive: true, force: true });
      }

      // 2. Delete from DB
      if (item.type === 'file') {
        await runQuery('DELETE FROM files WHERE id = ?', [item.id]);
      } else if (item.type === 'folder' && item.isProject) {
        await runQuery('DELETE FROM files WHERE project_id = ?', [item.id]);
        await runQuery('DELETE FROM folders WHERE project_id = ?', [item.id]);
        await runQuery('DELETE FROM projects WHERE id = ?', [item.id]);
      } else if (item.type === 'folder') {
        await runQuery(`DELETE FROM files WHERE path LIKE ?`, [item.path + '%']);
        await runQuery(`DELETE FROM folders WHERE path LIKE ?`, [item.path + '%']);
        await runQuery('DELETE FROM folders WHERE id = ?', [item.id]);
      }
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('rename-file', async (event, { id, oldPath, newName }) => {
    try {
      const newPath = path.join(path.dirname(oldPath), newName);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
      await runQuery('UPDATE files SET name = ?, path = ? WHERE id = ?', [newName, newPath, id]);
      return { id, newName, newPath };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('move-file', async (event, { id, oldPath, newFolderId, newParentPath }) => {
    try {
      const fileName = path.basename(oldPath);
      const newPath = path.join(newParentPath, fileName);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
      // if newFolderId is null, it means it's moved directly under project, but folder_id is allowed to be null if project_id is kept? 
      // Actually, wait, let's keep it simple: we just update folder_id and path.
      await runQuery('UPDATE files SET folder_id = ?, path = ? WHERE id = ?', [newFolderId, newPath, id]);
      return { id, newFolderId, newPath };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('log-time', async (event, { projectId, durationSeconds }) => {
    try {
      const id = crypto.randomUUID();
      await runQuery('INSERT INTO time_logs (id, project_id, duration_seconds) VALUES (?, ?, ?)', [id, projectId, durationSeconds]);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('get-time', async (event, projectId) => {
    try {
      const rows = await getQuery('SELECT SUM(duration_seconds) as total FROM time_logs WHERE project_id = ?', [projectId]);
      return rows[0]?.total || 0;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
}
