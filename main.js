const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const CONFIG_FILE_NAME = 'app-config.json';
const BD_FOLDER_NAME = 'bd';

// Ruta base: junto al ejecutable en producción, o junto al proyecto en desarrollo.
const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
// Configuracion persistente: vive en userData para sobrevivir actualizaciones/reinstalaciones.
const persistentConfigPath = path.join(app.getPath('userData'), CONFIG_FILE_NAME);
// Ruta antigua (legacy) para migracion de instalaciones previas.
const legacyConfigPath = path.join(baseDir, CONFIG_FILE_NAME);

let mainWindow = null;
let settingsWindow = null;
let appConfig = null;
let configMigratedThisBoot = false;
let userDataPath = '';
let lenguajesPath = '';
let snippetsPath = '';
let mediaPath = '';

// Datos iniciales de lenguajes
const defaultLenguajes = [
  { "ID": 1, "Nombre": "JavaScript", "Codigo": "js", "Activo": true },
  { "ID": 2, "Nombre": "HTML", "Codigo": "html", "Activo": true },
  { "ID": 3, "Nombre": "CSS", "Codigo": "css", "Activo": true }
];

function getDefaultConfig() {
  return {
    autor: '',
    bdDirectory: path.join(baseDir, BD_FOLDER_NAME)
  };
}

function normalizeBdDirectory(rawPath) {
  const defaultPath = path.join(baseDir, BD_FOLDER_NAME);
  if (!rawPath || typeof rawPath !== 'string') return defaultPath;

  const cleanPath = rawPath.trim();
  if (!cleanPath) return defaultPath;

  if (path.basename(cleanPath).toLowerCase() === BD_FOLDER_NAME) {
    return cleanPath;
  }

  return path.join(cleanPath, BD_FOLDER_NAME);
}

function applyConfig(config) {
  const incomingConfig = config && typeof config === 'object' ? config : {};

  appConfig = {
    ...getDefaultConfig(),
    ...incomingConfig,
    bdDirectory: normalizeBdDirectory(incomingConfig.bdDirectory)
  };

  userDataPath = appConfig.bdDirectory;
  lenguajesPath = path.join(userDataPath, 'lenguajes.json');
  snippetsPath = path.join(userDataPath, 'snippets.json');
  mediaPath = path.join(userDataPath, 'media');
}

function loadConfig() {
  const defaults = getDefaultConfig();
  configMigratedThisBoot = false;

  // Migracion one-time desde ubicacion legacy (carpeta instalacion/proyecto) a userData.
  if (!fs.existsSync(persistentConfigPath) && fs.existsSync(legacyConfigPath)) {
    try {
      fs.mkdirSync(path.dirname(persistentConfigPath), { recursive: true });
      fs.copyFileSync(legacyConfigPath, persistentConfigPath);
      configMigratedThisBoot = true;
      console.log(`Configuracion migrada: ${legacyConfigPath} -> ${persistentConfigPath}`);
    } catch (migrationError) {
      console.error('Error migrando configuracion legacy:', migrationError);
    }
  }

  if (!fs.existsSync(persistentConfigPath)) {
    fs.writeFileSync(persistentConfigPath, JSON.stringify(defaults, null, 2));
    applyConfig(defaults);
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(persistentConfigPath, 'utf-8'));
    applyConfig(data);
  } catch (error) {
    console.error('Error leyendo configuración. Se usarán valores por defecto:', error);
    fs.writeFileSync(persistentConfigPath, JSON.stringify(defaults, null, 2));
    applyConfig(defaults);
  }
}

function saveConfig(nextConfig) {
  applyConfig({ ...(appConfig || getDefaultConfig()), ...(nextConfig || {}) });
  fs.writeFileSync(persistentConfigPath, JSON.stringify(appConfig, null, 2));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icoEitrion.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isRefreshShortcut = (input.control || input.meta) && input.key.toLowerCase() === 'r';
    if (isRefreshShortcut && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow.webContents.send('shortcut-refresh-form');
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 620, // Aumentado para mostrar todas las opciones
    resizable: false,
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: true,
    icon: path.join(__dirname, 'icoEitrion.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Migrar archivos JSON de un directorio bd a otro
function migrateFiles(fromDir, toDir) {
  if (!fromDir || !fs.existsSync(fromDir)) return;

  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }

  const filesToMigrate = ['lenguajes.json', 'snippets.json'];
  for (const fileName of filesToMigrate) {
    const srcPath = path.join(fromDir, fileName);
    const destPath = path.join(toDir, fileName);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Migrado: ${srcPath} → ${destPath}`);
    }
  }
}

// Inicializar archivos si no existen
function initFiles() {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  if (!fs.existsSync(mediaPath)) {
    fs.mkdirSync(mediaPath, { recursive: true });
  }

  if (!fs.existsSync(lenguajesPath)) {
    fs.writeFileSync(lenguajesPath, JSON.stringify(defaultLenguajes, null, 2));
  }
  if (!fs.existsSync(snippetsPath)) {
    fs.writeFileSync(snippetsPath, JSON.stringify([], null, 2));
  }
}

app.whenReady().then(() => {
  loadConfig();
  initFiles();
  
  // Handlers para IPC
  ipcMain.handle('read-data', (event, fileType) => {
    try {
      const filePath = fileType === 'lenguajes' ? lenguajesPath : snippetsPath;
      if (!fs.existsSync(filePath)) return [];
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error leyendo ${fileType}:`, error);
      return [];
    }
  });

  ipcMain.handle('write-data', (event, fileType, data) => {
    try {
      const filePath = fileType === 'lenguajes' ? lenguajesPath : snippetsPath;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      console.error(`Error escribiendo ${fileType}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-settings-window', () => {
    createSettingsWindow();
    return { success: true };
  });

  ipcMain.handle('read-app-config', () => {
    return {
      ...appConfig,
      _configMigrated: configMigratedThisBoot
    };
  });

  ipcMain.handle('write-app-config', (event, config) => {
    try {
      const oldBdDirectory = userDataPath; // capturar antes de aplicar la nueva config
      saveConfig(config || {});

      // Si el directorio cambió, migrar archivos existentes al nuevo destino
      if (oldBdDirectory && oldBdDirectory !== userDataPath) {
        migrateFiles(oldBdDirectory, userDataPath);
      }

      // Solo crea archivos que aún faltan (defaults) sin sobreescribir los migrados
      initFiles();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('config-updated', appConfig);
      }

      return { success: true, config: appConfig };
    } catch (error) {
      console.error('Error guardando configuración:', error);
      return { success: false, error: error.message };
    }
  });

  // === MEDIA HANDLERS ===

  ipcMain.handle('open-image-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Imágenes y GIFs', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }
      ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('save-media-file', (event, srcPath) => {
    try {
      if (!fs.existsSync(mediaPath)) fs.mkdirSync(mediaPath, { recursive: true });
      const ext = path.extname(srcPath).toLowerCase();
      const uid = crypto.randomBytes(8).toString('hex');
      const fileName = `media_${Date.now()}_${uid}${ext}`;
      const destPath = path.join(mediaPath, fileName);
      fs.copyFileSync(srcPath, destPath);
      return { success: true, fileName };
    } catch (error) {
      console.error('Error guardando archivo de media:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-media-buffer', (event, { arrayBuffer, ext }) => {
    try {
      if (!fs.existsSync(mediaPath)) fs.mkdirSync(mediaPath, { recursive: true });
      const uid = crypto.randomBytes(8).toString('hex');
      const fileName = `media_${Date.now()}_${uid}${ext}`;
      const destPath = path.join(mediaPath, fileName);
      fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
      return { success: true, fileName };
    } catch (error) {
      console.error('Error guardando buffer de media:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-media-file', (event, fileName) => {
    try {
      const filePath = path.join(mediaPath, fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando archivo de media:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-media-url', (event, fileName) => {
    const filePath = path.join(mediaPath, fileName);
    if (!fs.existsSync(filePath)) return null;
    // Convertir a URL compatible con file:// usando forward slashes
    return 'file:///' + filePath.replace(/\\/g, '/');
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Error abriendo enlace:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-readme', async () => {
    try {
      const readmePath = path.join(baseDir, 'README.txt');
      await shell.openPath(readmePath);
      return { success: true };
    } catch (error) {
      console.error('Error abriendo README:', error);
      return { success: false, error: error.message };
    }
  });

  createMainWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
