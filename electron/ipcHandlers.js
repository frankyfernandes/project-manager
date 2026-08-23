import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import crypto from 'crypto';
import http from 'http';
import url from 'url';
import { google } from 'googleapis';

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
    
    // Auto-create default Kanban board
    const boardName = `${name.toUpperCase().replace(/\s+/g, '_')}_NOTES.board`;
    const boardId = crypto.randomUUID();
    const boardPath = path.join(projectPath, boardName);
    
    if (!fs.existsSync(boardPath)) {
      fs.writeFileSync(boardPath, '');
    }
    
    await runQuery(`INSERT INTO files (id, project_id, folder_id, name, type, path, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [boardId, id, null, boardName, 'file', boardPath, 1]);

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
        if (item.is_default) {
          throw new Error('Cannot delete a default project file.');
        }
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

  ipcMain.handle('add-instant-note', async (event, { projectId, noteText }) => {
    try {
      let files = await getQuery('SELECT * FROM files WHERE project_id = ? AND is_default = 1', [projectId]);
      let boardFile;
      
      if (files.length === 0) {
        const projects = await getQuery('SELECT * FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) throw new Error("Project not found.");
        
        const project = projects[0];
        const boardName = `${project.name.toUpperCase().replace(/\s+/g, '_')}_NOTES.board`;
        const boardId = crypto.randomUUID();
        const boardPath = path.join(project.path, boardName);
        
        if (!fs.existsSync(boardPath)) {
          fs.writeFileSync(boardPath, '');
        }
        
        await runQuery(`INSERT INTO files (id, project_id, folder_id, name, type, path, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
          [boardId, projectId, null, boardName, 'file', boardPath, 1]);
          
        boardFile = { path: boardPath };
        
        // Let the frontend know a file was added so Explorer can refresh? 
        // We can just rely on the user seeing it later, or they can refresh.
      } else {
        boardFile = files[0];
      }
      
      const content = fs.existsSync(boardFile.path) ? fs.readFileSync(boardFile.path, 'utf-8') : '';
      
      let boardData;
      try {
        boardData = JSON.parse(content);
        if (!boardData.columns || !Array.isArray(boardData.columns)) {
          throw new Error("Invalid structure");
        }
      } catch (e) {
        boardData = {
          columns: [
            { id: 'todo', title: 'To-Do', cards: [] },
            { id: 'in-progress', title: 'In Progress', cards: [] },
            { id: 'done', title: 'Done', cards: [] }
          ]
        };
      }
      
      const newCard = {
        id: crypto.randomUUID(),
        title: noteText,
        type: 'note',
        content: '',
        createdAt: new Date().toISOString(),
        history: [{ timestamp: new Date().toISOString(), action: 'created' }]
      };
      
      let todoCol = boardData.columns.find(c => c.id === 'todo' || c.title.toLowerCase() === 'to-do' || c.title.toLowerCase() === 'todo');
      if (!todoCol) {
        todoCol = { id: 'todo', title: 'To-Do', cards: [] };
        boardData.columns.unshift(todoCol);
      }
      
      todoCol.cards.push(newCard);
      
      fs.writeFileSync(boardFile.path, JSON.stringify(boardData, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error("Error adding instant note:", e);
      throw e;
    }
  });

  ipcMain.handle('sign-in-with-google', async (event, clientId, clientSecret) => {
    return new Promise((resolve, reject) => {
      const redirectUri = 'http://localhost:3000/oauth2callback';
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.file'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
      });
      
      let authWindow = null;
      
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url.indexOf('/oauth2callback') > -1) {
            const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
            const code = qs.get('code');
            
            res.end('<html><body><h2>Authentication successful!</h2><p>You can close this window now.</p><script>window.close()</script></body></html>');
            server.destroy();
            
            if (authWindow && !authWindow.isDestroyed()) {
              authWindow.close();
            }
            
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            
            fs.writeFileSync(path.join(appFolder, 'tokens.json'), JSON.stringify(tokens));

            const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
            const userInfo = await oauth2.userinfo.get();
            
            resolve({ user: userInfo.data, tokens });
          }
        } catch (e) {
          res.end('Authentication failed: ' + e.message);
          server.destroy();
          reject(e);
        }
      });
      
      const connections = new Set();
      server.on('connection', conn => {
        connections.add(conn);
        conn.on('close', () => connections.delete(conn));
      });
      server.destroy = () => {
        server.close();
        for (const conn of connections) {
          conn.destroy();
        }
      };
      
      server.listen(3000, () => {
        authWindow = new BrowserWindow({
          width: 600,
          height: 700,
          webPreferences: {
            partition: 'persist:browser',
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        // Strip Electron from User-Agent to bypass Google's "disallowed_useragent" block
        const customUserAgent = authWindow.webContents.getUserAgent().replace(/Electron\/\S*\s/, '').replace(/project-manager\/\S*\s/, '');
        authWindow.webContents.setUserAgent(customUserAgent);

        authWindow.loadURL(authUrl);
        
        authWindow.on('closed', () => {
          authWindow = null;
        });
      });
    });
  });

  ipcMain.handle('create-google-file', async (event, { type, projectName, fileName, clientId, clientSecret }) => {
    try {
      const tokensPath = path.join(appFolder, 'tokens.json');
      if (!fs.existsSync(tokensPath)) {
        throw new Error("No tokens found. Please sign in again.");
      }
      
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000/oauth2callback');
      oauth2Client.setCredentials(tokens);
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Check if project folder exists
      const query = `mimeType='application/vnd.google-apps.folder' and name='${projectName}' and trashed=false`;
      const res = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });
      
      let folderId;
      if (res.data.files && res.data.files.length > 0) {
        folderId = res.data.files[0].id;
      } else {
        // Create folder
        const folder = await drive.files.create({
          resource: {
            name: projectName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        folderId = folder.data.id;
      }
      
      // Create document or sheet
      const mimeType = type === 'sheet' 
        ? 'application/vnd.google-apps.spreadsheet' 
        : 'application/vnd.google-apps.document';
        
      const file = await drive.files.create({
        resource: {
          name: fileName,
          mimeType,
          parents: [folderId]
        },
        fields: 'id, webViewLink'
      });
      
      return file.data.webViewLink;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
}
