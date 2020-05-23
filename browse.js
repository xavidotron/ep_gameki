var async = require("async");
var queue = require("queue-async");
var execFile = require('child_process').execFile;
var spawn = require('child_process').spawn;
var fs = require('fs');
var startsWith = require("underscore.string/startsWith");
var endsWith = require("underscore.string/endsWith");
var yaml = require('js-yaml');
var temp = require('temp');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var glob = require("glob")

var AuthorManager = require("ep_etherpad-lite/node/db/AuthorManager");
var GroupManager = require("ep_etherpad-lite/node/db/GroupManager");
var PadManager = require("ep_etherpad-lite/node/db/PadManager");
var PadMessageHandler = require("ep_etherpad-lite/node/handler/PadMessageHandler");
var SessionManager = require("ep_etherpad-lite/node/db/SessionManager");

var serve = require("ep_bazki/serve");
var ERR = serve.ERR;
var db = require('ep_bazki/db');
var util = require('ep_bazki/util');
var svn = require('ep_bazki/svn');

var GAMETEX_TYPE_MAP = {
  char: 'PC',
};

function viewForTexFile(name) {
  if (startsWith(name, 'Lists/')) {
    return 'list';
  } else if (startsWith(name, 'LaTeX/')
             || startsWith(name, 'Production/')
             || startsWith(name, 'Handouts/')) {
    return 'edit';
  } else {
    return 'sheet';
  }
}
serve.registerExtension('.tex', viewForTexFile);

function getMetadata(project, padid, callback) {
  PadManager.getPad(padid, '', function (error, pad) {
    if (error) { callback(error); return; }

    db.getMetadataFromPad(project, pad, callback);
  });
}

function addListEntry(project, cls, info, callback) {
  var list_entry = '\n\\NEW{' + info.body.objtype
    + '}{' + info.body.macro + '}{\n  \\s\\MYname    {' 
    + info.body.name
    + '}\n';
  if (info.body.file) {
    list_entry += '  \\s\\MYfile    {' + info.body.file + '}\n';
  }
  // TODO(xavid): add other fields?
  list_entry += '}\n';
  svn.append_file(project, util.listForClass(cls), list_entry, info.author,
                 callback);
}

function createFile(project, dir, info, res) {
  var name = info.body['file'];

  var cls = util.classForDirectory(project, dir);

  var cont = function (data) {
    var q = queue();
    q.defer(svn.new_file, project, dir + name, data, info.author);
    if ('objtype' in info.body) {
      q.defer(addListEntry, project, cls, info);
    } else if ('macro' in info.body && !('no_edit_list' in info.body)) {
      db.setMacroMetadata(
        project, util.listForClass(
          util.classForDirectory(project, dir)),
        info.body.macro, 'file', name, info.authorid)
    }
    q.await(function (error) {
      if (error) { console.log('createFile', error); return; }
      res.redirect(info.query.return_to || '/g/' + project + '/e/' + dir + name);
    });
  };

  if (endsWith(name, '.tex')) {
    fs.readFile(
      util.get_checkout(project) + dir
        + '_template.tex', {encoding: 'utf-8'},
      function (error, data) {
        if (error) {
          console.log("read template", error);
          if (viewForTexFile(dir + name) == 'sheet') {
            var macro = "\\" + cls[0] + "Test";
            if ('macro' in info.body) {
              macro = info.body.macro;
            }
            
            cont("\\documentclass[" + cls + "]{" + project 
                 + "}\n\\begin{document}\n\\name{" + macro
                 + "{}}\n\n\n\\end{document}\n");
          } else {
            cont("\n");
          }
        } else {
          if ('macro' in info.body) {
            data = data.replace(/\\name\{\\[a-zA-Z]+\{\}\}/,
                                '\\name{' + info.body.macro + '{}}');
          }
          
          cont(data);
        }
      });
  } else {
    cont("\n");
  }
}

serve.registerView('edit', function (project, path, info, res) {
  res.render("edit.ejs", {
    padid: info.groupid + '$' + util.path_to_padid(path),
  });
});
serve.registerView('sheet', function (project, path, info, res) {
  var padid = info.groupid + '$' + util.path_to_padid(path);
  getMetadata(project, padid, function (error, macro, metadata) {
    if (error) { console.log('/sheet/2', error); return; }
    res.render("sheet.ejs", {
      padid: padid,
      links: {'Edit as file': '/g/' + project + '/edit/' + path},
      macro: macro,
      metadata: metadata,
      list: util.listForPath(project, path),
    });
  });
});
serve.registerView('list', function (project, path, info, res) {
  db.mapEntriesFromList(project, path, function (error, entries, fields) {
    if (error) { ERR(error, res); return; }

    var data = {};
    data[util.classForList(path)] = entries;
    res.render("tables.ejs", {
      data: data,
      columns: ['macro', 'type'].concat(fields),
      links: {'Edit as file': '/g/' + project + '/edit/' + path},
    });    
  });
});

var temp_dir = temp.mkdirSync("gameki");
function prod(project, path, cb) {
  //var tmp = temp_dir + '/' + project + '/';
  var prod_path = util.get_checkout(project) + 'bin/prod';
  queue()
    .defer(util.exists, prod_path)
    //.defer(mkdirp, tmp + util.dirname(path))
    .await(function (error, has_prod) {
      if (error) { cb(error); return; }
      
      // TODO(xavid): only go here if it ends with .pdf
      var stemmatch = path.match(/^(.+)\.pdf/);

      var checkout = util.get_checkout(project);
      var cmd;
      var env = {PATH: process.env.PATH};
      var include_stderr = true;
      var cwd = checkout;
      var args = ['-o', temp_dir];
      var out_path;
      if (stemmatch) {
        args.push(stemmatch[1] + '.tex');
        out_path = temp_dir + '/' + path;
      } else {
        // Probably something like listchar-cJamesBond.
        args.push(path);
        out_path = temp_dir + '/prod/' + path + '.pdf';
      }
      if (has_prod) {
        cmd = prod_path;
      } else {
        cmd = __dirname + '/bin/prod';
      }
      
      execFile(
        cmd, args, {cwd: cwd, env: env},
        function (error, stdout, stderr) {
          // TODO(xavid): show errors properly
          if (error) {
            if (include_stderr) {
              error.output = stdout + stderr;
            } else {
              error.output = stdout;
            }
            cb(error); return; // Figure out log stuff.
            if (error.killed === false) {
              fs.readFile(
                checkout + stem + '.log',
                function (log_error, log) {
                  if (log_error) {
                    console.log('log_error', log_error);
                  }
                  
                  error.log = log;
                  cb(error);
                });
            } else {
              cb(error);
            }
            return;
          }
          cb(null, out_path);
        });
    });
}

function maybe_readdir(path, cb) {
  fs.readdir(path, function (error, contents) {
    if (error) {
      if (error.code == 'ENOENT') {
        cb(null, []);
      } else {
        cb(error);
      }
      return;
    }
    cb(null, contents);
  });
}

var YAML_CONFIG = ['zephyr_class'];
var DEF_CONFIG = ['gamename', 'gamedate', 'takedownby'];

exports.expressCreateServer = function (hook_name, context, cb) {
  var views = context.app.get('views');
  if (typeof(views) == 'string') { views = [views]; }
  context.app.set('views', views.concat(__dirname + '/templates/'));

  serve.register_path_url(context.app, 'prod', function (project, path, info, res) {
    prod(project, path, function (error, result_path) {
      if (error) { ERR(error, res); return; }
      res.sendFile(result_path);
      //fs.readFile(
      //  tmp + path,
      //  function (error, data) {
      //    if (error) { ERR(error, res); return; }
      //    res.set('Content-Type', 'application/pdf');
      //    res.send(data);
      //    //rimraf(tmp, function (error) {
      //    //  if (error) { console.log('rimraf', error); }
      //    //});
      //  });
    });
  });

  // /g/.../atext/
  serve.register_path_url(context.app, 'atext', function (project, path, info, res) {
    var tilde_bits = path.split('~')
    db.get_project_pad(project, tilde_bits[0], tilde_bits[1]).then(function (pad) {
      var tchars = util.atextToTaggedChars(pad, true);
      var text = '';
      for (var i = 0; i < tchars.length; ++i) {
        text += tchars[i].replace('\n', "'\\n'") + '\n'
      }
      res.render("pre.ejs", {
        text: text,
      });
    });
  });

  // /g/.../text/
  serve.register_path_url(context.app, 'text', function (project, path, info, res) {
    db.get_project_pad(project, path).then(function (pad) {
      res.render("pre.ejs", {
        text: pad.atext.text,
      });
    });
  });

  // /g/.../readfile/
  serve.register_path_url(context.app, 'readfile', function (project, path, info, res) {
    fs.readFile(util.get_checkout(project) + path, function (error, data) {
      if (error) { ERR(error, res); return; }

      res.render("pre.ejs", {
        text: data,
      });
    });
  });

  // /g/.../mkdir/
  serve.register_path_url(context.app, 'mkdir', function (project, path, info, res) {
    var dir = path + (info.body.name || '');
    if (!endsWith(dir, '/')) {
      dir += '/';
    }
    svn.mkdir(
      project, dir, info.author, 
      function (error) {
        if (error) { ERR(error, res); return; }
        res.redirect('/g/' + project + '/e/' + dir);
      });
  });

  // /g/.../rm/
  serve.register_path_url(context.app, 'rm', function (project, path, info, res) {
    svn.rm(
      project, path, info.author, 
      function (error) {
        if (error) { ERR(error, res); return; }
        res.redirect('/g/' + project + '/e/'
                     + /^(.*\/|)[^\/]+\/?$/.exec(path)[1]);
      });
  });

  // /g/.../rename/
  serve.register_path_url(context.app, 'rename', function (project, path, info, res) {
    if ('name' in info.body) {
      var newpath = path.replace(/[^\/]+$/, info.body.name);
      svn.mv(
        project, path, newpath, info.author,
        function (error) {
          if (error) { ERR(error, res); return; }
          res.redirect('/g/' + project + '/e/' + newpath);
        });
    } else {
      res.render("rename.ejs");
    }
  });

  // /g/.../create/
  serve.register_path_url(context.app, 'create', createFile);

  // /g/.../new/
  serve.register_path_url(context.app, 'new', function (project, cls, info, res) {
    var noun = util.singularForClass(project, cls);
    var dir = util.directoryForClass(project, cls);
    if (!('name' in info.body)) {
      var gametex_type;
      if (cls in GAMETEX_TYPE_MAP) {
        gametex_type = GAMETEX_TYPE_MAP[cls];
      } else {
        gametex_type = cls[0].toUpperCase() + cls.slice(1);
      }
      res.render("new.ejs", {
        noun: noun,
        cls: cls,
        objtype: gametex_type,
        return_to: info.query.return_to,
        path: dir,
      });
    } else {
      if (dir) {
        createFile(project, dir, info, res);
      } else {
        addListEntry(project, cls, info, function (error) {
          if (error) { ERR(error, res); return; }
          res.redirect(info.query.return_to 
                       || '/g/' + project + '/e/' + util.listForClass(cls));
        });
      }
    }
  });

  serve.register_plain_url(context.app, 'config', function (project, info, res) {
    queue().defer(db.get_project_pad, project, 'Gameki/config.yaml')
      .defer(db.get_project_pad, project, 'LaTeX/' + project + '.cls')
      .await(function (error, yaml_pad, cls_pad) {
        if (error) { ERR(error, res); return; }
        
        var cls_data = cls_pad.atext.text;
        var yaml_config = {};
        if ('gamename' in info.body) {
          for (var k in info.body) {
            // TODO(xavid): silly hack
            if (/_/.exec(k)) {
              yaml_config[k] = info.body[k];
            } else {
              var re = RegExp('^(\\\\def\\\\' + k + ')\\{([^}]*)\\}', 'm');
              cls_data = cls_data.replace(re, '$1{' + info.body[k] + '}');
            }
          }
          if (cls_data != cls_pad.atext.text) {
            db.setPadTxt(cls_pad, cls_data, info.authorid);
          }
          var yaml_data = yaml.safeDump(yaml_config);
          if (yaml_data != yaml_pad.atext.text) {
            db.setPadTxt(yaml_pad, yaml_data, info.authorid);
            zephyr_sub(project, info.body.zephyr_class);
          }
        } else {
          if (yaml_pad.atext.text) {
            yaml_config = yaml.safeLoad(yaml_pad.atext.text);
          }
        }

        var params = {};
        for (var i = 0; i < YAML_CONFIG.length; ++i) {
          params[YAML_CONFIG[i]] = yaml_config[YAML_CONFIG[i]];
        }
        for (var i = 0; i < DEF_CONFIG.length; ++i) {
          var re = RegExp('^\\\\def\\\\' + DEF_CONFIG[i] + '\\{([^}]*)\\}',
                          'm');
          var m = re.exec(cls_data);
          params[DEF_CONFIG[i]] = m ? m[1] : null;
        }

        res.render("config.ejs", params);
      });
  });

  serve.register_plain_url(context.app, 'status', function (
    project, info, res) {
    queue().defer(db.mapEntriesFromList, project, 'Lists/char-LIST.tex')
      .defer(db.mapEntriesFromList, project, 'Lists/blue-LIST.tex')
      .defer(db.mapEntriesFromList, project, 'Lists/green-LIST.tex')
      .defer(db.mapEntriesFromList, project, 'Lists/white-LIST.tex')
      .defer(db.mapYamlFromDirectory, project, 'Handouts/')
      .defer(maybe_readdir, util.get_checkout(project) + 'Notes/')
      .await(function (error, chars, blues, greens, whites, handouts, notedir) {
        if (error) { ERR(error, res); return; }

        var data = {};
        data['char'] = chars;
        data['blue'] = blues;
        data['green'] = greens;
        data['white'] = whites;
        data['Handouts'] = handouts;

        data['Notes'] = [];
        for (var i = 0; i < notedir.length; ++i) {
          data['Notes'].push({path: 'Notes/' + notedir[i], file_exists: true,
                              name: notedir[i], name_readonly: true});
        }

        var q = queue();
        for (var k in data) {
          for (var i = 0; i < data[k].length; ++i) {
            console.log(data[k][i].file, /\.[^/]+$/.exec(data[k][i].file));
            if (data[k][i].file && !/\.[^/]+$/.exec(data[k][i].file)) {
              data[k][i].file += '.tex';
            }
            data[k][i].words_readonly = true;
            if (data[k][i].path) {
              q.defer(function (map, callback) {
                var subid = 'body';
                if (k == 'Notes') {
                  subid = null;
                }
                db.get_project_pad(project, map.path, subid,
                  function (error, pad) {
                    if (error) {
                      callback(error);
                    } else {
                      var m = pad.atext.text.match(/\b\S+\b/g);
                      if (m) {
                        map.words = m.length;
                      }
                      callback();
                    }
                  });
              }, data[k][i]);
            }
          }
        }

        q.await(function (error) {
          if (error) { ERR(error, res); return; }
          
          res.render("tables.ejs", {
            title: 'Status',
            data: data,
            columns: ['macro', 'name', 'owner', 'status', 'words', 'note'],
            column_whitelist: {
              Handouts: ['name', 'owner', 'status', 'words', 'note'],
              Notes: ['name', 'words'],
            },
          });
        });
      });
  });

  serve.register_plain_url(context.app, 'mail', function (project, info, res) {
    if (info.body.message) {
      res.render("message.ejs", {
        title: info.body.message,
      });
      return;
    }

    var run = info.query.run || '1';
    var checkout = util.get_checkout(project);
    var args = [info.query.template, '--run', run];
    if (info.body.send) {
      if (info.body.dryrun) {
        args.push('--dry-run');
      } else {
        args.push('--send');
      }
      serve.startWait(res);
      var process = spawn(checkout + 'bin/mail', args, {cwd: checkout});
      process.stdin.write(info.body.password);
      process.on('exit', function (code, signal) {
        if (code || signal) { ERR(code || signal, res); return; }
        serve.finishWait(res, '', {'message': process.stdin.read()});
      });
    } else {
      var q = queue();
      q.defer(glob, "Lists/run*-LIST.tex", {cwd: checkout})
        .defer(execFile, checkout + 'bin/mail', ['--list'], {cwd: checkout});
      if (info.query.template) {
        q.defer(execFile, checkout + 'bin/mail', args,
                {cwd: checkout});
      }
      q.await(function (error, runs, templates, output) {
        if (error) { ERR(error, res); return; }

        runs = runs.map(function (n) {
          return /Lists\/run(.*)-LIST.tex/.exec(n)[1];
        });

        res.render("mail.ejs", {
          title: "Mail",
          runs: runs,
          run: run,
          output: output,
          templates: templates.trim().split('\n'),
          template: info.query.template,
        });
      });
    }
  });

  // Special snowflakes

  // Controllerless redirect.
  context.app.get(/^\/g\/([^\/]+)\/?$/, function (req, res) {
    res.redirect('/g/' + req.params[0] + '/e/');
  });

  // /about
  context.app.get('/about', function (req, res) {
    res.render("about.ejs");
  });

  // /error
  context.app.get('/error', function (req, res) {
    console.error("/error");
    res.render("message.ejs", {
      title: "/error",
    });    
  });

  // /crash
  context.app.get('/crash', function (req, res) {
    console.error("/crash");
    queue().defer(fs.readdir, '/')
      .await(function () { non_existent_function(); });
  });

  // /newgame
  serve.registerRepoCreator(context.app, '/newgame',
                            __dirname + "/bin/new-gametex.sh");

  // /addmit
  context.app.all('/addmit', function (req, res) {
    var show_form = !('project' in req.body);
    var message = req.body.message;
    if (!show_form && req.body.project.indexOf(' ') != -1) {
      message = "The project identifier can't contain a space.";
      show_form = true;
    }
    if (!show_form && req.body.path && req.body.path.indexOf('..') != -1) {
      message = "The path can't contain ..!";
      show_form = true;
    }
    if (show_form) {
      res.render("addmit.ejs", {message: message});
    } else {
      serve.startWait(res);
      execFile(
        __dirname + "/bin/add-mit.sh",
        [req.body.project, req.body.path, req.body.username,
         req.body.password],
        function (error, stdout, stderr) {
          if (error) {
            console.log('new', error, stderr);
            serve.finishWait(res, '/addmit',
                             {message: stderr || "Adding failed."});
            return;
          }
          queue().defer(svn.svn_read_all, req.body.project,
                        new serve.WaitTicker(res), false)
            .defer(svn.createSpecialPads, req.body.project)
            .await(function () {
              serve.finishWait(res, '/g/' + req.body.project + '/login');
            });
        });
    }
  });

  // /s/
  context.app.get('/s/:filename(*)', function (req, res) {
    res.sendFile(__dirname + '/static/' + req.params.filename,
                 {maxAge: '6h'});
  });

  cb();
};

exports.handleMessage = function (hook_name, context, cb) {
  if (context.message.type == "COLLABROOM") {
    if (context.message.data.type == "CLIENT_MESSAGE"
        && context.message.data.payload.type == "SET_METADATA") {
      var msg = context.message.data.payload;
      // May not be the actual pad id, tables sets this to a fake pad in the
      // group.
      var pad_id = PadMessageHandler.sessioninfos[context.client.id].padId;
      var project = db.groupid_to_project(pad_id.split('$')[0]);
      if (msg.macro) {
        db.setMacroMetadata(
          project, msg.list, msg.macro, msg.key, msg.value,
          PadMessageHandler.sessioninfos[context.client.id].author);
      } else {
        db.setFileMetadata(
          project, msg.path, msg.key, msg.value,
          PadMessageHandler.sessioninfos[context.client.id].author);
      }
      cb(null);
      return;
    } else if (context.message.data.type == "CHAT_MESSAGE") {
      var authorid = PadMessageHandler.sessioninfos[context.client.id].author;
      var text = context.message.data.text;
      var padid = PadMessageHandler.sessioninfos[context.client.id].padId;
      var parts = padid.split('$')
      var project = db.groupid_to_project(parts[0]);
      if (project && project in project_to_zephyr_class) {
        queue().defer(AuthorManager.getAuthorName, authorid)
          .defer(PadManager.getPad, padid, '')
          .defer(GroupManager.listPads, parts[0])
          .await(function (error, author, pad, padsdata) {
            if (error) { console.log('zwrite author', error); return; }
            execFile(
              "/usr/bin/zwrite", ['-c', project_to_zephyr_class[project],
                                  '-i', db.pad_to_path(pad), '-S', author,
                                  '-O', 'gameki', '-m', text],
              function (error, stdout, stderr) {
                if (error) {
                  console.log('zwrite', error, stderr);
                }
              });
            for (var i = 0; i < padsdata.padIDs.length; ++i) {
              if (padsdata.padIDs[i] != padid) {
                PadMessageHandler.sendChatMessageToPadClients(
                  Date.now(), authorid, text, padsdata.padIDs[i]);
              }
            }
          });
      }
    }
  }
  cb();
};

exports.eejsBlock_indexWrapper = function (hook_name, context, cb) {
  context.content = fs.readFileSync(__dirname + '/data/index.html');
  cb();
};

var project_to_zephyr_class = {};
var zephyr_class_to_project = {};

function zephyr_sub(project, zephyr_class) {
  console.log('Subscribing to -c', zephyr_class);
  if (project in project_to_zephyr_class) {
    delete zephyr_class_to_project[project_to_zephyr_class[project]];
  }
  if (zephyr_class) {
    project_to_zephyr_class[project] = zephyr_class;
    zephyr_class_to_project[zephyr_class] = project;
    tzc.stdin.write('((tzcfodder . subscribe) ("' + zephyr_class 
                    + '" "*" "*"))');
  } else {
    delete project_to_zephyr_class[project];
  }
}

if (fs.existsSync('/usr/bin/tzc')) {
  var tzc = spawn('/usr/bin/tzc');
  tzc.stdout.on('data', function (data) {
    data = data.toString();
    if (!startsWith(data, ';')) {
      var m = /\(class \. ([^)]+)\).*\(opcode \. ([^)]+)\).*\(sender \. "([^"]+)"\).*\(message \. \("(?:[^"\\]|\\"|\\\\)*" "((?:[^"\\]|\\"|\\\\)*)" *\)/.exec(data);
      if (m) {
	var cls = m[1];
	var opcode = m[2];
	var sender = m[3];ṭa
        var msg = m[4].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        
        if (opcode != 'gameki' && cls in zephyr_class_to_project) {
          var project = zephyr_class_to_project[cls];
          db.get_groupid(project, function (error, group_id) {
            queue()
              .defer(AuthorManager.createAuthorIfNotExistsFor, sender, sender)
              .defer(GroupManager.listPads, group_id)
              .await(function (error, authordata, padsdata) {
                if (error) { console.log('TZC', error); return; }
                for (var i = 0; i < padsdata.padIDs.length; ++i) {
                  PadMessageHandler.sendChatMessageToPadClients(
                    Date.now(), authordata.authorID, msg, padsdata.padIDs[i]);
                }
              });
          });
        }
      } else if (!startsWith(data, '((tzcspew . cutoff)')) {
        console.log('TZC', data);
      }
    }
  });
}

CONFIGS = {};
util.for_each_project(function (project) {
  fs.readFile(
    util.get_checkout(project) + 'Gameki/config.yaml',
    function (error, yaml_data) {
      if (error) {
        if (error.code != 'ENOENT') {
          console.log('zephyr init', project, error);
        }
        return;
      }
      var yaml_config = yaml.safeLoad(yaml_data);
      console.log(project, yaml_config);
      CONFIGS[project] = yaml_config;
      if (yaml_config) {
        if (yaml_config.zephyr_class) {
          zephyr_sub(project, yaml_config.zephyr_class);
        }
        // TODO(xavid): have the update on edit
        if (yaml_config.classes) {
          util.setOverridesForProject(project, yaml_config.classes);
        }
      }
    });
});
