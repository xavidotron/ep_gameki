"use strict";
var os = require('os');
var execFile = require('child_process').execFile;

var colors = {
  ALL: "grey", 
  TRACE: "blue", 
  DEBUG: "cyan", 
  INFO: "green", 
  WARN: "yellow", 
  ERROR: "red", 
  FATAL: "magenta", 
  OFF: "grey"
};

function zwriteAppender(zephyr_class, suppress) {
  if (suppress) {
    suppress = new RegExp(suppress);
  }
  return function(loggingEvent) {
    var message = loggingEvent.data.toString();
    if (suppress && suppress.test(message)) {
      return;
    }
    execFile(
      "/usr/bin/zwrite",
      ['-c', zephyr_class,
       '-i', loggingEvent.level.toString(),
       '-s', os.hostname(),
       '-O', 'auto',
       '-m', '@<@color(' + colors[loggingEvent.level.toString()] + ')'
             + message.replace(/@/g, '@@').replace(/>/g, '@(>)') 
             + '>'],
      function (error, stdout, stderr) {
        if (error) {
          console.error('zwrite_filter', error, stderr);
        }
      });
  };
}

function configure(config) {
  return zwriteAppender(config.zephyr_class, config.suppress);
}

exports.appender = zwriteAppender;
exports.configure = configure;
