var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : process.env.db_user,
  password : process.env.db_password,
  database : process.env.db_database
});
 
connection.connect(function(err) {
  if (err) {
      console.error('error connecting: ' + err.stack);
      return;
  }

  console.log('connected as id ' + connection.threadId);
});

module.exports = connection