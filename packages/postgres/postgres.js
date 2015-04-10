// PostgreSQL connection
pg = Npm.require('pg');
var conString = 'postgres://postgres:1234@localhost/postgres';

// TODO: reset command for development (in command line need a reset that does dropdb <name> and createdb <name>

Postgres = {};

/* objects: DataTypes, TableConstraints, QueryOperators, SelectOptions, and Joins */

Postgres._DataTypes = {
  $number: 'integer',
  $string: 'varchar(255)',
  $json: 'json',
  $datetime: 'date',
  $float: 'decimal',
  $seq: 'serial'
};

Postgres._TableConstraints = {
  $unique: 'unique',
  $check: 'check ', // + parens around a conditional
  $exclude: 'exclude', //
  $notnull: 'not null',
  $default: 'default ', // + literal constant 'field data_type DEFAULT string/function'
  $primary: 'primary key'
};

Postgres._QueryOperators = {
  // TODO: not currently in use
  $eq: ' = ',
  $gt: ' > ',
  $lt: ' < '
};

Postgres._SelectOptions = {
  // TODO: not currently in use
  $gb: 'GROUP BY ',
  $lim: 'LIMIT ',
  $off: 'OFFSET '
};

Postgres._Joins = {
  $loj: ' LEFT OUTER JOIN ',
  $lij: ' LEFT INNER JOIN '
};

/* methods: createTable, createRelationship, alterTable, dropTable, insert, select, update, delete, autoSelect */

///**
// * TODO: user accounts, role management, authentication, IMPORTANT: add id option, default, add 'now'
// * @param {string} table
// * @param {object} tableObj
// * @param {string} tableObj key (field name)
// * @param {array} tableObj value (type and constraints)
// * @param {string} [relTable]
// */

//Postgres.createTable('students', {
//  name: ['$string', '$notnull'],
//  age: ['$number'],
//  class: ['$string', {$default: '2015'}]
//});
//CREATE TABLE students(id serial primary key not null, name varchar(255) not null, age integer, class varchar(255) default 2015,

//Postgres.createTable('students', {
//  name: ['$string', '$notnull'],
//  age: ['$number'],
//  class: ['$string', {$default: '2015'}],
//  _id: ['$number', '$notnull', '$primary', '$unique']
//});
//CREATE TABLE students (name varchar(255) not null, age integer, class varchar(255) default 2015, _id integer not null primary unique,
Postgres.createTable = function(table, tableObj, relTable) {
  // SQL: 'CREATE TABLE table (fieldName constraint);'
  // initialize input string parts
  var inputString = 'CREATE TABLE ' + table + ' (';
  var item, subKey, valOperator;
  // iterate through array arguments to populate input string parts
  for (var key in tableObj) {
    inputString += key + ' ';
    inputString += this._DataTypes[tableObj[key][0]];
    if (Array.isArray(tableObj[key]) && tableObj[key].length > 1) {
      for (var i = 1, count = tableObj[key].length; i < count; i++) {
        item = tableObj[key][i];
        if (typeof item === 'object') {
          subKey = Object.keys(item);
          valOperator = this._TableConstraints[subKey];
          inputString += ' ' + valOperator + item[subKey];
        } else {
          inputString += ' ' + this._TableConstraints[item];
        }
      }
    }
    inputString += ', ';
  }
  // check to see if id provided
  if (inputString.indexOf('_id') === -1) {
    inputString += '_id serial primary key not null,';
  }

  // add foreign key
  if(relTable) {
    inputString += ' ' + relTable + '_id' + ' integer references ' + relTable + ' (_id)';
  }
  //inputString += ');';
  // add notify functionality and close input string
  inputString += " created_at TIMESTAMP default now()); " +
  "CREATE FUNCTION notify_trigger() RETURNS trigger AS $$ "+
  "DECLARE " +
  "BEGIN " +
  "PERFORM pg_notify('watchers', '{' || TG_TABLE_NAME || ':' || NEW.id || '}'); " +
  "RETURN new; " +
  "END; " +
  "$$ LANGUAGE plpgsql; " +
  "CREATE TRIGGER watched_table_trigger AFTER INSERT ON "+ table +
  " FOR EACH ROW EXECUTE PROCEDURE notify_trigger();";
  // send request to postgresql database
  pg.connect(conString, function(err, client) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in create table " + table, error);
      } else {
        console.log("results in create table " + table); //, results
      }
    });
    client.on('notification', function(msg) {
      var returnMsg = eval("(" + msg.payload + ")");
      var k = '';
      var v = '';
      for (var key in returnMsg){
        k = key;
        v = returnMsg[key];
      }
      var selectString = "select * from " + k + " where id = " + v + ";";
      client.query(selectString, function(error, results) {
        if (error) {
          console.log("error in create table " + table, error);
        } else {
          //console.log("results in create table ", results.rows);
        }
      });

    });
    var query = client.query("LISTEN watchers");
  });
};

/**
 * TODO:
 * @param {string} table1
 * @param {string} table2
 */
Postgres.createRelationship = function(table1, table2) {
  // SQL: 'CREATE TABLE table1_table2(
  //    table1_id INT NOT NULL REFERENCES table1(id) on delete cascade,
  //    table2_id INT NOT NULL REFERENCES table2(id) on delete cascade,
  //    primary key(table1_id, table2_id) );'
  var table = table1 + '_' + table2;
  var inputString = 'CREATE TABLE ' + table + '(' +
      table1 + '_id int not null references ' + table1 + '(id) on delete cascade,' +
      table2 + '_id int not null references ' + table2 + '(id) on delete cascade,' + ');';
  // send request to postgresql database
  pg.connect(conString, function(err, client) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in create relationship " + table, error);
      } else {
        //console.log("results in create relationship " + table, results);
      }
    });
    // client.on('notification', function(msg) {
    //   console.log(msg);
    // });
    var query = client.query("LISTEN watchers");
  });
};

Postgres.addColumn = function(table, tableObj) {
  var inputString = 'ALTER TABLE ' + table + ' ADD COLUMN ';
  // iterate through array arguments to populate input string parts
  for (var key in tableObj) {
    inputString += key + ' ';
    inputString += this._DataTypes[tableObj[key][0]] + ' ';
    for (var i = 1, count = tableObj[key].length - 1; i < count; i++) {
      inputString += tableObj[key][i] + ' ';
    }
  }
  inputString += ';';
  pg.connect(conString, function(err, client) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in create relationship " + table, error);
      } else {
        //console.log("results in create relationship " + table, results);
      }
    });
    // client.on('notification', function(msg) {
    //   console.log(msg);
    // });
    var query = client.query("LISTEN watchers");
  });
};

Postgres.dropColumn = function(table, column) {
  var inputString = 'ALTER TABLE ' + table + ' DROP COLUMN ' + column;
  inputString += ';';
  pg.connect(conString, function(err, client) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in create relationship " + table, error);
      } else {
        //console.log("results in create relationship " + table, results);
      }
    });
    // client.on('notification', function(msg) {
    //   console.log(msg);
    // });
    var query = client.query("LISTEN watchers");
  });
};

/**
 * TODO: Cascade or restrict?
 * @param {string} table
 */
Postgres.dropTable = function(table) {
  var inputString = 'DROP FUNCTION IF EXISTS notify_trigger() CASCADE; DROP TABLE IF EXISTS ' + table + ' CASCADE;';
  // send request to postgresql database
  pg.connect(conString, function(err, client, done) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in drop " + table, error);
      } else {
        //console.log("results in drop " + table, results);
      }
      done();
    });
  });
};

/**
 * TODO: foreign key associations
 * @param {string} table
 * @param {object} insertObj
 * @param {string} insertObj key (field name)
 * @param {string} insertObj value (value)
 */
Postgres.insert = function(table, insertObj) {
  // SQL: 'INSERT INTO table (insertFields) VALUES (insertValues);'
  // initialize input string parts
  var inputString = 'INSERT INTO ' + table + ' (';
  var valueString = ') VALUES (';
  var keys = Object.keys(insertObj);
  var insertArray = [];
  // iterate through array arguments to populate input string parts
  for (var i = 0, count = keys.length - 1; i < count; ) {
    inputString += keys[i] + ', ';
    insertArray.push(insertObj[keys[i]]);
    valueString += '$' + (++i) + ', ';
  }
  // combine parts and close input string
  inputString += keys[keys.length-1] + valueString + '$' + keys.length + ');';
  insertArray.push(insertObj[keys[keys.length-1]]);
  // send request to postgresql database
  console.log(inputString);
  console.log(insertArray);
  pg.connect(conString, function(err, client, done) {
    if (err){
      console.log(err);
    }
    client.query(inputString, insertArray, function(error, results) {
      if (error) {
        console.log("error in insert " + table, error);
      } else {
        //console.log("results in insert " + table, results);
      }
      done();
    });
  });
};

Postgres._SelectAddons = {
  $gb: 'GROUP BY ',
  $lim: 'LIMIT ',
  $off: 'OFFSET '
};


///**
// * TODO: JOINS, LOGICAL OPERATORS AND / OR, REGEX
// * @param {object} tableObj
// * @param {string} tableObj key (table name)
// * @param {array} tableObj value (field names)
// * @param {object} selectObj
// * @param {string} selectObj key (field name)
// * @param {object} selectObj.fieldName key (operator)
// * @param {object} selectObj.fieldName value (comparator)
// * @param {object} optionsObj
// * @param {string} optionsObj key (option)
// * @param {number} optionsObj value (comparator)
// * @param {object} joinObj
// */
Postgres.select = function(tableName, returnFields, selectObj, optionsObj, joinObj) {
  // SQL: 'SELECT fields FROM table WHERE field operator comparator AND (more WHERE) GROUP BY field / LIMIT number / OFFSET number;'

  function _emptyObject(obj) {
    for (var prop in obj) {
      if (Object.prototype.propertyIsEnumerable.call(obj, prop)) {
        return false;
      }
    }
    return true;
  }

  // tableObj
  // contains the table name as key and the fields as a string
  // for all fields user can pass in the table name as a string (need to insert * into the inputString)
  var table = tableName;
  if (returnFields.length === 0) {
    returnFields = ' * ';
  }
  else {
      returnFields = '(' + returnFields.join(', ') + ')';
  }

  // selectObj
  // contains the field as a key then another obj as the value with the operator and conditional values
  //  Postgres.select({students: ['name', 'age']}, {age: {$gt: 18}}); -> WHERE age > 18
  var selectString = '';
  if (selectObj && !_emptyObject(selectObj)) {
    var selectField, operator, comparator, key;
    selectField = Object.keys(selectObj)[0];
    key = Object.keys(selectObj[selectField])[0];
    operator = this._QueryOperators[key];
    comparator = selectObj[selectField][key];
    selectString += ' WHERE ' + selectField + operator + comparator;
  }
  // logical operators
  // if key is $or or $and $not $nor
  // if key is string

  // optionsObj
  // object that can contain keys from SelectOptions and values of strings or integers or floats
  //{ name: {$lm: 1}}
  var optionsString = '';
  if (optionsObj && !_emptyObject(optionsObj)) {
    var limit, group, offset, optionField;
    optionField = Object.keys(optionsObj)[0];
    group = optionsObj[optionField]['$gb'] ? (' GROUP BY ' + optionsObj[optionField]['$gb']) : '';
    offset = optionsObj[optionField]['$off'] ? (' OFFSET ' + optionsObj[optionField]['$off']) : '';
    limit = optionsObj[optionField]['$lm'] ? (' LIMIT ' + optionsObj[optionField]['$lm']) : '' ;
    optionsString += group + offset + limit;
  }

  // joinObj TODO: helper table joins
  // object contains keys from join and values of table names
  // for foreign key it will be table1 join table2 on table1.table2_id = table2._id
  // {$fk: [$loj, 'contacts']}
  var joinString = '';
  if (joinObj && !_emptyObject(joinObj)) {
    var joinTable, joinType, tableField, joinField;
    var type = Object.keys(joinObj)[0];
    joinType = this._Joins[joinObj[type][0]];
    joinTable = joinObj[type][1];
    if (type === '$fk') {
      tableField = table + '.' + joinTable + '_id';
      joinField = joinTable + '._id';
    }
    //else if (type === '$tb') {
    //}
    joinString += joinType + joinTable + ' ON '+ tableField + ' = ' + joinField;
  }

  var inputString = 'SELECT ' + returnFields + ' FROM ' + table + joinString + selectString + optionsString + ';';
  console.log(inputString);
  pg.connect(conString, function(err, client, done) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in select " + table, error);
      } else {
        console.log("results in select " + table, results.rows);
      }
      done();
      return results.rows[0];
      //callback(results.rows);
    });
  });
};

Postgres.newUpdate = function(table, updateObj, selectObj) {
  var inputString;
  var selectString = '';
  if (selectObj && !_emptyObject(selectObj)) {
    var selectField, operator, comparator, key;
    selectField = Object.keys(selectObj)[0];
    key = Object.keys(selectObj[selectField])[0];
    operator = this._QueryOperators[key];
    comparator = selectObj[selectField][key];
    selectString += ' WHERE ' + selectField + ' ' + operator + ' ' + comparator;
  }
  // UPDATE table SET fields VALUE values WHERE fields operator comparator
  inputString += selectString + ';';

};

///**
// * TODO: OR to selectObj
// * @param {string} tableName
// * @param {string} selectName  -> field to update
// * @param {object} selectObj
// * @param {string} selectObj key (field name)
// * @param {object} selectObj.fieldName key (operator)
// * @param {object} selectObj.fieldName value (comparator) -> filters
// * @param {object} updateObj
// * @param {string} updateObj key (field name)
// * @param {number} updateObj value (updated data) -> updates
// */
Postgres.update = function(table, updateObj, selectObj) {
  // SQL: 'UPDATE table SET fields VALUE values WHERE fields operator comparator;'
  var inputString = 'UPDATE ' + table + ' SET ';

  function _emptyObject(obj) {
    for (var prop in obj) {
      if (Object.prototype.propertyIsEnumerable.call(obj, prop)) {
        return false;
      }
    }
    return true;
  }

  var selectString = '';
  if (selectObj && !_emptyObject(selectObj)) {
    var selectField, operator, comparator, key;
    selectField = Object.keys(selectObj)[0];
    key = Object.keys(selectObj[selectField])[0];
    operator = this._QueryOperators[key];
    comparator = selectObj[selectField][key];
    selectString += ' WHERE ' + selectField + operator + comparator;
  }

  var updateString = ''; // fields VALUE values {'class': 'senior'}
  if (updateObj && !_emptyObject(updateObj)) {
    var updateField = '(', updateValue = '(', keys = Object.keys(updateObj);
    if (keys.length > 1) {
      for (var i = 0, count = keys.length-1; i < count; i++) {
        updateField += keys[i] + ', ';
        updateValue += "'" + updateObj[keys[i]] + "', ";
      }
      updateField += keys[keys.length - 1];
      updateValue += "'" + updateObj[keys[keys.length - 1]] + "'";
    } else {
      updateField += keys[0];
      updateValue += "'" + updateObj[keys[0]] + "'";
    }
    updateString += updateField + ') = ' + updateValue + ')';
  }

  inputString += ' ' + updateString + selectString + ';';
  pg.connect(conString, function(err, client, done) {
    if (err){
      console.log(err);
    }
    console.log(inputString);
    client.query(inputString, function(error, results) {
      if (error) {
        console.log("error in update " + table, error);
      } else {
        console.log("results in update " + table, results.rows);
      }
      done();
    });
  });
};

/**
 * TODO: Additional where parameters
 * @param table
 * @param selectObj
 */
Postgres.delete = function (table, selectObj) {
  // SQL: 'DELETE FROM table * WHERE field operator comparator;'
  var inputString = 'DELETE FROM ' + table;

  var selectString = '';
  if (selectObj) {
    var selectField, operator, comparator;
    selectField = Object.keys(selectObj)[0];
    operator = Object.keys(selectObj[selectField])[0];
    comparator = selectObj[selectField][operator];
    selectString += 'WHERE ' + selectField + ' ' + operator + ' ' + comparator;
  }

  inputString += selectString + ';';

  pg.connect(conString, function(err, client, done) {
    if (err){
      console.log(err);
    }
    client.query(inputString, function(error, results) {
      if (error) {
      console.log("error in delete " + table, error);
      } else {
        //console.log("results in delete " + table, results.rows);
      }
      done();
    });
  });
};

Postgres.autoSelect = function (sub) {
  pg.connect(conString, function(err, client) {
    var selectString = "select id, text from " + "tasks" + " ORDER BY id DESC LIMIT 10;";
    client.query(selectString, function(error, results) {
      if (error) {
        console.log("error in auto select " + table, error);
      } else {
        sub._session.send({
          msg: 'added',
          collection: sub._name,
          id: sub._subscriptionId,
          fields: {
            reset: false,
            results: results.rows
          }
        });
        return results.rows;
      }
    });
    var query = client.query("LISTEN watchers");
    client.on('notification', function(msg) {
      var returnMsg = eval("(" + msg.payload + ")");
      var k = '';
      var v = '';
      for (var key in returnMsg) {
        k = key;
        v = returnMsg[key];
      }
      var selectString = "select id, text from " + k + " ORDER BY id DESC LIMIT 10;";
      client.query(selectString, function(error, results) {
        if (error) {
          console.log("error in auto select " + table, error);
        } else {
          sub._session.send({
            msg: 'added',
            collection: sub._name,
            id: sub._subscriptionId,
            fields: {
              reset: false,
              results: results.rows
            }
          });
          return results.rows;
        }
      });
    });
  });
};

Postgres.getCursor = function(){
  var cursor = {};
  //Creating publish
  cursor._publishCursor = function(sub){
    this.autoSelect(sub);
  };
  cursor.autoSelect = this.autoSelect;
  return cursor;
};

Postgres.loadData = function(table, sub){
  console.log('postgres sub', sub.instance);
  pg.connect(conString, function(err, client) {
    client.query("select * from " + table, function(error, results) {
      if (error) {
        console.log("error in auto select " + table, error);
      } else {
        //console.log(results.rows);
        //sub.instance._session.send({
        //  msg: 'loaded',
        //  collection: sub._name,
        //  id: sub._subscriptionId,
        //  fields: {
        //    reset: false,
        //    results: results.rows
        //  }
        //});
        sub.instance.insertData(results.rows);
        return results.rows;
      }
    });
  });
};