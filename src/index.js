const Store = require('electron-store');
const { app, BrowserWindow, safeStorage, ipcMain } = require('electron')
const twig = require('electron-twig')
const path = require('node:path')
const {
  v4: uuidv4,
} = require('uuid');

const store = new Store();
// store.delete('config');

var config = store.get('config');
if (!config) {
  config = {
    'databases': []
  };
  store.delete('config');
  store.set('config', config);
}

var saveConfig = function() {
  store.set('config', config);
}
console.log(config);

var handleRx = function(event, data) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  var returnData = {'status':'ok','payload':{}};
  
  if (data.action == 'get_databases') {
    returnData.payload = config['databases'];
  }

  if (data.action == 'store_database_delete') {
    var data_id = data.id;
    for(var index in config['databases']) {
      if (config['databases'][index].id == data_id) {
        config['databases'].splice(index, 1);
        break;
      }
    }
    saveConfig();
  }

  if (data.action == 'store_database_info') {
    config['databases'].push({
      'id': uuidv4(),
      'name': data.db_name,
      'hostname': data.db_hostname,
      'port': data.db_port,
      'username': data.db_username,
      'password': data.db_password,
      'database': data.db_database,      
    });

    saveConfig();
  }

  if (data.action == 'navigate') {
    if (data.page == 'menu_databases_manage') {
      win.loadFile('views/databases_manage.html.twig');
    }
    if (data.page == 'menu_databases_add') {
      win.loadFile('views/databases_add.html.twig');
    }
  }

  return returnData;
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  ipcMain.on('tx', (event, payload) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    console.log(payload);
  });

  win.openDevTools();
  win.setMenu(null);
  win.maximize();
  win.loadFile('views/home.html.twig');
}

app.whenReady().then(() => {
  createWindow();

  console.log(safeStorage.isEncryptionAvailable());
  console.log(safeStorage.encryptString("hello"));

  ipcMain.handle('rx', handleRx);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  }); 
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});