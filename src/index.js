const { app, BrowserWindow, safeStorage, ipcMain } = require('electron')
var isWin = process.platform === "win32";
if (isWin) {
  if (require('electron-squirrel-startup')) app.quit();
}

var mysql = require('mysql');

const Store = require('electron-store');
const twig = require('electron-twig')
const path = require('node:path')
const {
  v4: uuidv4,
} = require('uuid');

var states = {
  'database_connected': false,
  'database_connection': false,
  'database_profiling': false,
  'missing_index_scanner': false,
  'win': false,
  'last_start_time': false,
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
          if(error) {            
            return resolve(error.code);
          }
          return resolve(results);
      });
  }).catch(() => { /* do whatever you want here */ });
};

var getFirstRow = function(results) {
  if (results) {
    return results[0];
  }
  return false;
}

var handleMainLoop = async function() {
  if (states.database_connected) {

    // handle deconnections errors

    if (states.database_profiling) {
      // var sql = "show variables where Variable_name = 'log_output'"; // save this and put it back 
      //https://mariadb.com/kb/en/mysqlslow_log-table/
      // var results = await dbQuery(states.database_connection, sql);
      
      // handle ; error permission ER_TABLEACCESS_DENIED_ERROR

      // console.log(getFirstRow(results));

      var sql = "SELECT * FROM mysql.slow_log";
      if (states.last_start_time) {
        sql += " WHERE start_time > '"+states.last_start_time.toString()+"'";
      }

      var results = await dbQuery(states.database_connection, sql);
      
      var payload = [];
      for ( var index in results ) {
        if (
          results[index].db != states.database_connection.config.database
          ||
          results[index].sql_text.startsWith("SET GLOBAL")
          ||
          results[index].sql_text.startsWith("SET SQL_MODE")
          ||
          results[index].sql_text.startsWith("SELECT GET_LOCK")
        ) {
          continue;
        }
        payload.push(results[index]);
        states.last_start_time = results[index].start_time;
      }

      var returnData = {
        'status': 'ok',
        'payload': payload,
        'action': 'update_profiling_tbody',
      };

      states.win.webContents.send('rx', returnData);
    }
  }
}

var handleTx = async function(event, data) {
  
  var webContents = event.sender;
  var win = BrowserWindow.fromWebContents(webContents);

  var returnData = {
    'uid': uuidv4(),
    'status':'ok',
    'payload':{},
    'action': data.action,
  };
  
  if (data.action == 'innodb_buffer_pool_optimization') {

    var sql = `SELECT CONCAT(CEILING(RIBPS/POWER(1024,pw)),SUBSTR(' KMGT',pw+1,1))
    Recommended_InnoDB_Buffer_Pool_Size FROM
    (
        SELECT RIBPS,FLOOR(LOG(RIBPS)/LOG(1024)) pw
        FROM
        (
            SELECT SUM(data_length+index_length)*1.1*growth RIBPS
            FROM information_schema.tables AAA,
            (SELECT 1.25 growth) BBB
            WHERE ENGINE='InnoDB'
        ) AA
    ) A;`;

    var results = await dbQuery(states.database_connection, sql);

    returnData.payload = {
      'results': results,
      'sql': sql,
    };

  }

  if (data.action == 'explain_query') {
    var sql = "EXPLAIN "+data.sql;
    var results = await dbQuery(states.database_connection, sql);
    returnData.payload = {
      'results': results,
      'sql': data.sql,
    };
  }

  if (data.action == 'get_databases') {
    returnData.payload = config['databases'];    
  }

  if (data.action == 'stop_profiling') {
    states.database_profiling = false;
    var sql = "SET GLOBAL log_output = 'FILE';";
    var results = await dbQuery(states.database_connection, sql);
    var sql = "SET GLOBAL slow_query_log = 'OFF'";
    var results = await dbQuery(states.database_connection, sql);
  }

  if (data.action == 'start_profiling') {
    var error = false;

    var sql = "TRUNCATE mysql.slow_log;";
    var results = await dbQuery(states.database_connection, sql);
    if (
      results == 'ER_TABLEACCESS_DENIED_ERROR'
      ||
      results == 'ER_SPECIFIC_ACCESS_DENIED_ERROR'
    ) { error = results; }

    var sql = "SET GLOBAL log_output = 'FILE,TABLE';";
    var results = await dbQuery(states.database_connection, sql);
    if (
      results == 'ER_TABLEACCESS_DENIED_ERROR'
      ||
      results == 'ER_SPECIFIC_ACCESS_DENIED_ERROR'
    ) { error = results; }

    var sql = "SET GLOBAL slow_query_log = 'ON'";
    var results = await dbQuery(states.database_connection, sql);
    if (
      results == 'ER_TABLEACCESS_DENIED_ERROR'
      ||
      results == 'ER_SPECIFIC_ACCESS_DENIED_ERROR'
    ) { error = results; }

    var sql = "SET GLOBAL log_queries_not_using_indexes = 'ON'";
    var results = await dbQuery(states.database_connection, sql);
    if (
      results == 'ER_TABLEACCESS_DENIED_ERROR'
      ||
      results == 'ER_SPECIFIC_ACCESS_DENIED_ERROR'
    ) { error = results; }

    var sql = "SET GLOBAL long_query_time = 0";
    var results = await dbQuery(states.database_connection, sql);
    if (
      results == 'ER_TABLEACCESS_DENIED_ERROR'
      ||
      results == 'ER_SPECIFIC_ACCESS_DENIED_ERROR'
    ) { error = results; }

    if (!error) {
      states.database_profiling = true;    
    } else {
      returnData.payload = {'error': error};
    }
  }

  if (data.action == 'missing_index_scanner') {
    states.missing_index_scanner = true;
    win.loadFile('views/loading.html.twig');
    twig.view = {
      loading_msg: 'Scanning for missing indexes...'
    };

    win.once('ready-to-show', async () => {
      win.webContents.send('rx', returnData);
      win.show();

      var sql = "SELECT * FROM mysql.slow_log";
      var results = await dbQuery(states.database_connection, sql);
      
      var payload = [];
      for ( var index in results ) {
        if (
          results[index].db != states.database_connection.config.database
          ||
          results[index].sql_text.startsWith("SET GLOBAL")
          ||
          results[index].sql_text.startsWith("SET SQL_MODE")
          ||
          results[index].sql_text.startsWith("SELECT GET_LOCK")
        ) {
          continue;
        }
        payload.push(results[index]);
      }

      for ( var index in payload ) {
        var sql = payload[index].sql_text;
        var explainSql = "EXPLAIN " + sql;
        var results = await dbQuery(states.database_connection, sql);
        for ( var indexResults in results ) {
          var type = results[indexResults].type;
          var table = results[indexResults].table;
          var tableAS = sql.split(" ");
          if ( tableAS.length > 1 ) {
            console.log(tableAS);
          }
          
          for ( var indexTAS in tableAS ) {

          }
          var rows = results[indexResults].rows;
          if (type == 'ref') {

          }
          // add index, run explain, check if rows is lower than without index
        }
      }

    });
  }

  if (data.action == 'connect_database') {
    win.loadFile('views/loading.html.twig');
    twig.view = {
      loading_msg: 'Connecting to database...'
    };

    states.database_connected = false;
    states.database_connection = false;

    var data_id = data.id;
    var index = getDatabaseIndex(data_id);
    
    if (index !== false) {
      var databaseInfo = config['databases'][index];

      states.database_connection = mysql.createConnection({
        host     : databaseInfo.hostname,
        port     : databaseInfo.port,
        user     : databaseInfo.username,
        password : databaseInfo.password,
        database : databaseInfo.database,
        "dateStrings": true
      });
    
      states.database_connection.connect(function(connect_error) {        
        if (connect_error) {          
          states.database_connected = false;      
        } else {
          states.database_connected = true;   
        }
        
        states.database_connection.query('SELECT 1 + 1 AS solution', function(query_error, rows, fields) {
          if (query_error) {          
            states.database_connected = false;      
          } else {
            states.database_connected = true;   
          }
          
          if (states.database_connected) {           
            win.loadFile('views/databases_connected.html.twig');
          } else {                  
            win.loadFile('views/databases_manage.html.twig');
          }
          
          states.database_connection.on('error', function onError(err) {
            states.database_connected = false;  
            win.loadFile('views/databases_manage.html.twig');
            returnData.payload = {'database_connected': states.database_connected};      
            win.once('ready-to-show', () => {
              win.webContents.send('rx', returnData);
              win.show();
            });
          });

          returnData.payload = {'database_connected': states.database_connected};      
          win.once('ready-to-show', () => {
            win.webContents.send('rx', returnData);
            win.show();
          });
        });   
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
      states.database_connected = false;
      win.loadFile('views/databases_manage.html.twig');
    }
    if (data.page == 'menu_databases_add') {
      win.loadFile('views/databases_add.html.twig');
    }
  }

  if (
    data.action != 'connect_database'
    && data.action != 'missing_index_scanner'
  ) {
    return win.webContents.send('rx', returnData);
  }
  
}

function createWindow () {
  states.win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: __dirname + '/assets/images/celerity.png',
  });

  states.win.openDevTools();

  states.win.setMenu(null);
  states.win.maximize();
  states.win.loadFile('views/home.html.twig');
}

app.whenReady().then(() => {
  createWindow();

  console.log(safeStorage.isEncryptionAvailable());
  console.log(safeStorage.encryptString("hello"));

  ipcMain.on('tx', handleTx);

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