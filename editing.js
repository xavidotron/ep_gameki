var fs = require('fs');

exports.padInitToolbar = function (hook_name, context, cb) {
  var menu = context.toolbar.button({
    command: "toggleMarkup",
    class: "buttonicon moon-plus-circle",
  });
  context.toolbar.registerButton("markup", menu);
  cb();
};

exports.clientVars = function (hook_name, context, cb) {
  cb({userIsGuest: context.pad.id.indexOf('$') == -1});
};

function fromFile(file) {
  return function (hook_name, context, cb) {
    context.content +=  fs.readFileSync(__dirname + '/data/' + file);
    cb();
  };
}

exports.eejsBlock_styles = fromFile('pad_head.html');
exports.eejsBlock_body = fromFile('popups.html');
