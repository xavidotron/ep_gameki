var endsWith = require("underscore.string/endsWith");
var startsWith = require("underscore.string/startsWith");

var PadManager = require("ep_etherpad-lite/node/db/PadManager");

var db = require('ep_bazki/db');
var util = require('ep_bazki/util');

var COMMENT_RE = /^(?:%[^\n]*\n)*\n*/;
var BODY_RE = /(\\begin\{document\}\n(?:\n*\\name\{[^{}]*(?:\{\})?\}\n)?\n?)([^]*)(\\end\{document\})/;

var under_comment_body = false;

exports.bazkiSavingPad = function (hook_name, context, cb) {
  var name = context.name;
  var text = context.text;
  if (endsWith(name, '.tex')) {
    if (!under_comment_body) {
      var comment = COMMENT_RE.exec(text);
      if (comment) {
        comment = comment[0].replace(/^%%? ?/mg, '');
      } else {
        comment = '\n';
      }
      PadManager.getPad(name + '~comment', '', function (error, pad) {
        if (error) { console.log('GPC', error); return; }
        db.setPadTxt(pad, comment, context.author);
      });
      var body = BODY_RE.exec(text);
      if (body) {
        PadManager.getPad(name + '~body', '', function (error, pad) {
          if (error) { console.log('GPB', error); return; }
          db.setPadTex(pad, body[2], context.author);
        });
      }
    }
  }
  cb();
}

exports.padUpdate = function (hook_name, context, cb) {
  var changed_pad = context.pad;
  var authorid = context.author;
  var name = changed_pad.id;

  if (name.indexOf('~') != -1) {
    if (db.isInternalEdit()) {
      cb();
      return;
    }

    var sp = name.split('~');
    if (endsWith(sp[0], '.tex')) {
      if (sp[1] == 'comment') {
        var ctext = changed_pad.atext.text.replace(/^/mg, '%% ')
          .replace(/^%% %/mg, '%%%').replace(/%% $/, '') + '\n';
        // console.log('CTEXT', changed_pad.atext.text, ctext);
        PadManager.getPad(sp[0], '', function (error, pad) {
          if (error) { console.log('GPc', error); return; }
        
          var match = pad.atext.text.match(COMMENT_RE);
          if (!match) {
            console.error('comment repl failed for ' + sp[0]);
            return;
          }
          var new_text = pad.atext.text.slice(0, match.index) + ctext
            + pad.atext.text.slice(match.index + match[0].length);

          under_comment_body = true;
          db.setPadTxt(pad, new_text, authorid);
          under_comment_body = false;
        });
      } else if (sp[1] == 'body') {
        var btext = util.taggedCharsToTex(util.atextToTaggedChars(changed_pad));
        
        PadManager.getPad(sp[0], '', function (error, pad) {
          if (error) { console.log('GPb', error); return; }

          var old = util.taggedCharsToTex(util.atextToTaggedChars(pad));
          var match = old.match(BODY_RE);
          if (!match) {
            console.error('body repl failed for ' + sp[0]);
            return;
          }
          var ptext = old.slice(0, match.index) + match[1] + btext + match[3]
            + old.slice(match.index + match[0].length);
          under_comment_body = true;
          db.setPadTex(pad, ptext, authorid);
          under_comment_body = false;
        });
      }
    }
    cb();
    return;
  }

  var namebits = name.split('$');
  if (namebits.length != 2) {
    cb();
    return;
  }
  var project = db.groupid_to_project(namebits[0]);
  var filename = db.pad_to_path(changed_pad);  

  // Update metadata via message
  if (endsWith(filename, '-LIST.tex')) {
    db.refreshMetadataForProject(project);
    db.refreshMapEntriesForList(project, filename);
  } else if (endsWith(filename, '.tex')) {
    db.updateMetadataForPad(project, changed_pad);
  } else if (endsWith(filename, '.yaml')) {
    // Handouts pads don't actually care.
    //PadManager.getPad(
    //  changed_pad.id.replace(/\.yaml$/, '.tex'), function (error, main_pad) {
    //    if (error) { console.log('yamlness', error); return; }
    //    db.updateMetadataForPad(project, main_pad);
    //  });
    db.refreshMapYaml(project, filename);
  }

  cb();
}
