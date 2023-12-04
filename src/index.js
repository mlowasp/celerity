var mysql = require('mysql');

const Store = require('electron-store');
const { app, BrowserWindow, safeStorage, ipcMain } = require('electron')
const twig = require('electron-twig')
const path = require('node:path')
const {
  v4: uuidv4,
} = require('uuid');

var states = {
  'database_connected': false,
  'database_connection': false,
  'database_profiling': false,
};

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

var getDatabaseIndex = function(data_id) {
  for(var index in config['databases']) {
    if (config['databases'][index].id == data_id) {
      return index;
    }
  }
}

var dbQuery = (connection, query) => {
  return new Promise((resolve, reject)=>{
      connection.query(query,  (error, results)=>{
          if(error){
              return reject(error);
          }
          return resolve(results);
      });
  });
};

var getFirstRow = function(results) {
  if (results) {
    return results[0];
  }
  return false;
}

var handleMainLoop = async function() {
  if (states.database_connected) {
    if (states.database_profiling) {
      var sql = "show variables where Variable_name = 'log_output'"; // save this and put it back 
      //https://mariadb.com/kb/en/mysqlslow_log-table/
      var results = await dbQuery(states.database_connection, sql);
      
      console.log(getFirstRow(results));

      var sql = "SET GLOBAL log_output = 'FILE,TABLE';";
      var sql = "set global slow_query_log = 'ON'";
      var sql = "set global log_queries_not_using_indexes = 'ON'";
      var sql = "set global long_query_time = 0";
      var sql = "select * FROM mysql.slow_log";
  
      var sql = "SET GLOBAL log_output = 'FILE';";
      var sql = "set global slow_query_log = 'OFF'";
    }
  }
}

var handleRx = function(event, data) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  var returnData = {'status':'ok','payload':{}};
  
  if (data.action == 'get_databases') {
    returnData.payload = config['databases'];
  }

  if (data.action == 'start_profiling') {
    states.database_profiling = true;
  }

  if (data.action == 'connect_database') {
    win.loadFile('views/loading.html.twig');
    twig.view = {
      loading_msg: 'Connecting to database...'
    };

    states.database_connected = false;

    var data_id = data.id;
    var index = getDatabaseIndex(data_id);
    if (index) {
      var databaseInfo = config['databases'][index];

      connection = mysql.createConnection({
        host     : databaseInfo.hostname,
        port     : databaseInfo.port,
        user     : databaseInfo.username,
        password : databaseInfo.password,
        database : databaseInfo.database
      });

      connection.connect(async function(err) {
        if (err) {
          console.error('error connecting: ' + err.stack);
          states.database_connected = false;
          return;
        }
       
        console.log('connected as id ' + connection.threadId);
        states.database_connected = true;
        states.database_connection= connection;
        
        win.loadFile('views/databases_connected.html.twig');

      });

    }
  }

  if (data.action == 'store_database_delete') {
    var data_id = data.id;
    var index = getDatabaseIndex(data_id);
    if (index) {
      config['databases'].splice(index, 1);
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

  setInterval(function() {
    handleMainLoop();
  }, 500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});