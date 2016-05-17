var muvis = false;

exports.postToolbarInit = function (hook_name, context, cb) {
  // Could maybe use toolbar.toggleDropDown()?
  context.toolbar.registerCommand("toggleMarkup", function (cmd, acew, item) {
    var e = $('#mumenu');
    var main = $('#editorcontainerbox');
    //e.get()[0].style.left = item.$el.position().left + 'px';
    if (muvis) {
      //e.animate({width: '0%'}, 'fast');
      main.animate({width: '100%'}, 'fast');
      muvis = false;
    } else {
      e.show();
      main.animate({width: '90%'}, 'fast');
      muvis = true;
    }
  });

  context.toolbar.registerAceCommand("insert", function (cmd, ace, item) {
    ace.ace_performDocumentReplaceRange(undefined, undefined, item);
  });

  function wrap(endbit, cmd, ace, item) {
    if (ace.ace_isCaret()) {
      ace.ace_performDocumentReplaceRange(undefined, undefined, item + endbit);
    } else {
      var rep = ace.ace_getDebugProperty('rep');
      ace.ace_performDocumentReplaceRange(rep.selEnd, rep.selEnd, endbit);
      ace.ace_performDocumentReplaceRange(rep.selStart, rep.selStart, item);
    }
  }

  context.toolbar.registerAceCommand("wrap", wrap.bind(null, '}'));
  context.toolbar.registerAceCommand("quotewrap", wrap.bind(null, '}{}'));

  cb();
};

exports.handleClientMessage_CUSTOM = function (hook_name, context, cb) {
  parent.handleMetadata(context.payload.macro, context.payload.metadata);
  cb();
};

exports.documentReady = function (hook_name, context, cb) {
  console.timeStamp('documentReady');
  cb();
}
