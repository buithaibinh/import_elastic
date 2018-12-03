'use strict';

var elasticsearch = require('elasticsearch');
var _ = require('lodash');
var moment = require('moment');
var chalk = require('chalk');

function Importer(options) {
  this.options = options;

  this.client = new elasticsearch.Client({
    host: options.host,
    log: options.log,
    requestTimeout: options.requestTimeout,
  });
}

Importer.prototype.send_to_elastic = function(body, cb) {
  var self = this;
  self.client.bulk({body: body}, function(err, resp) {
    if (err || resp.errors) {
      if (cb) {
        return cb(err || resp.errors);
      }

      var color = self.options.warnErrors ? chalk.yellow : chalk.red;
      console.log(color('Elastic Import: Error importing data'));

      if (err) {
        console.log(err);
      } else {
        var errors = _.filter(resp.items, function(item) {
          return (item.index && item.index.error) || (item.create && item.create.error);
        });

        errors.map(function(item) {
          var message = item.index ? item.index.error : item.create.error;
          console.log(color('Error: ' + message.type), color('-'), color('Reason: ' + message.reason), message.caused_by ? color('- Caused by: ' + message.caused_by.reason) : '');
        });
        console.log(color('Elastic Import: Sent ' + body.length + ' records (' + errors.length + ' errors)'));
      }

      if (!self.options.warnErrors) {
        process.exit(1);
      }
    } else {
      console.log(chalk.green('Elastic Import: Sent ' + body.length + ' records'));
    }

    return cb && cb(null, resp);
  });
};

Importer.prototype.import = function(data, cb) {
  var self = this;
  var body = [];
  if (!_.isArray(data)) {
    data = [data];
  }

  data.map(function(record) {
    Object.keys(record).map(function(key) {
      if (_.isObject(record[key])) {
        if (record[key]['$oid']) {
          record[key] = record[key]['$oid'];
        } else if (record[key]['$date']) {
          record[key] = moment(record[key]['$date']).toDate();
        }
      }
    });

    if (self.options.ignore) {
      self.options.ignore.split(',').map(function(ignore) {
        ignore = ignore.trim();
        if (ignore.indexOf('[*].') !== -1) {
          var field = ignore.substring(0, ignore.indexOf('[*]'));
          var obj = record[field];
          if (obj && _.isArray(obj)) {
            var afterField = ignore.substring(ignore.indexOf('[*].') + 4);
            obj.map(function(value) {
              _.unset(value, afterField);
            });
          }
        } else {
          _.unset(record, ignore);
        }
      });
    }

    if (self.options.transform) {
      record = self.options.transform(record) || record;
    }

    if (record._id) {
      body.push({index: {_index: self.options.index, _type: self.options.type, _id: record._id}});
      record.SakeId = record._id;
      delete record._id;
    } else {
      body.push({index: {_index: self.options.index, _type: self.options.type}});
    }
    // TODO, some default for sakenomy only
    if (record.Status === '') {
      // 0: not yet pick, 1: on checking, 2: done
      record.Status = 0;
    }
    if (record.UserId === 'NULL') {
      record.UserId = '';
    }
    body.push(record);
  });

  self.client.bulk({body: body}, function(err, resp) {
    if (err || resp.errors) {
      if (cb) {
        return cb(err || resp.errors);
      }

      var color = self.options.warnErrors ? chalk.yellow : chalk.red;
      console.log(color('Elastic Import: Error importing data'));

      if (err) {
        console.log(err);
      } else {
        var errors = _.filter(resp.items, function(item) {
          return (item.index && item.index.error) || (item.create && item.create.error);
        });

        errors.map(function(item) {
          var message = item.index ? item.index.error : item.create.error;
          console.log(color('Error: ' + message.type), color('-'), color('Reason: ' + message.reason), message.caused_by ? color('- Caused by: ' + message.caused_by.reason) : '');
        });
        console.log(color('Elastic Import: Sent ' + data.length + ' records (' + errors.length + ' errors)'));
      }

      if (!self.options.warnErrors) {
        process.exit(1);
      }
    } else {
      console.log(chalk.green('Elastic Import: Sent ' + data.length + ' records'));
    }

    return cb && cb(null, resp);
  });
};

module.exports = Importer;
