var assert = require("assert");
var fs = require("fs");
var util = require("ep_bazki/util");
var AttributePool = require("ep_etherpad-lite/static/js/AttributePool");
var Changeset = require("ep_etherpad-lite/static/js/Changeset");

describe('makeChangeset', function () {
  it('basic', function () {
    assert.equal("Z:3>1=3+1$d", util.makeChangeset('foo', 'food'));
    assert.equal("Z:4<1=3-1$", util.makeChangeset('food', 'foo'));
    assert.equal("Z:7>5|1=4=3|1+2+3$d\nbaz", 
                 util.makeChangeset('foo\nbar', 'foo\nbard\nbaz'));
    assert.equal("Z:c<5|1=4=3|1-2-3$", 
                 util.makeChangeset('foo\nbard\nbaz', 'foo\nbar'));
    assert.equal("Z:3>0$", util.makeChangeset('foo', 'foo'));
  });

  it('tex', function () {
    assert.equal("Z:3>1=2-1*0+2$od",
                   util.makeChangeset(util.texToTaggedChars('foo'), 
                                      util.texToTaggedChars('fo\\textbf{od}'),
                                      new AttributePool()));
  });

  it('ul', function () {
    var ap = new AttributePool();
    assert.equal("Z:4>0-1*0*1*2+1$*",
                 util.makeChangeset(['*', 'F', 'o', 'o'],
                                    ['*1', 'F', 'o', 'o'], ap)); 
    assert.deepEqual(['list', 'bullet1'], ap.getAttrib(0));
  });

  it('two uls', function () {
    var ap = new AttributePool();
    assert.equal("Z:0>6*0*1*2+1|2+3*0*1*2+1+1$*A\n\n*B",
                 util.makeChangeset([],
                                    ['*1', 'A', '\n', '\n', '*1', 'B'], ap)); 
    assert.deepEqual(['list', 'bullet1'], ap.getAttrib(0));
  });

  it('heading', function () {
    var ap = new AttributePool();
    assert.equal("Z:3>1*0*1*2+1$*",
                 util.makeChangeset(['F', 'o', 'o'],
                                    ['h2', 'F', 'o', 'o'], ap)); 
    assert.deepEqual(['heading', 'h2'], ap.getAttrib(0));
  });

  it('indent', function () {
    var ap = new AttributePool();
    assert.equal("Z:0>6*0*1*2+1|2+3*0*1*2+1+1$*A\n\n*B",
                 util.makeChangeset([],
                                    ['_1', 'A', '\n', '\n', '_1', 'B'], ap)); 
    assert.deepEqual(['list', 'indent1'], ap.getAttrib(0));
  });
});

var CASES = {
  'no markup': [['f', 'o', 'o'], 'foo'],
  'basic': [['f', 'ob', 'o'], 'f\\textbf{o}o'],
  'unclosed': [['f', '\\', 't', 'e', 'x', 't', 'b', 'f',
                '{', 'o', 'o'], 'f\\textbf{oo'],
  'nested': [['f', 'ob', 'obi'], 'f\\textbf{o\\emph{o}}'],
  'series': [['f', 'ob', 'oi'], 'f\\textbf{o}\\emph{o}'],
  'only braces': [['\\', 'f', '{', 'o', 'o', '}'], '\\f{oo}'],
  'unknown env': [['\\', 'b', 'e', 'g', 'i', 'n', '{', 'a', '}', '\n',
                   'f', 'o', 'o', '\n',
                   '\\', 'e', 'n', 'd', '{', 'a', '}'],
                  '\\begin{a}\nfoo\n\\end{a}'],
  'ul': [['*1', 'F', 'o', 'o', '\n', '*1', 'B', 'a', 'r', '\n'],
         '\\begin{itemz}\n\\item Foo\n\\item Bar\n\\end{itemz}'],
  'ol': [['#1', 'F', 'o', 'o', '\n', '#1', 'B', 'a', 'r', '\n'],
         '\\begin{enum}\n\\item Foo\n\\item Bar\n\\end{enum}'],
  'nested list': [['*1', 'F', 'o', 'o', '\n', '#2', 'Bb', 'ab', 'rb', '\n',
                   '*1', 'B', 'a', 'z', '\n'],
                  '\\begin{itemz}\n\\item Foo\n\\begin{enum}\n\\item \\textbf{Bar}\n\\end{enum}\n\\item Baz\n\\end{itemz}'],
  'followed': [['*1', 'F', 'o', 'o', '\n', '*1', 'B', 'a', 'r', '\n',
                'B', 'a', 'z'],
               '\\begin{itemz}\n\\item Foo\n\\item Bar\n\\end{itemz}\nBaz'],
  'indent': [['_1', 'F', 'o', 'o', '\n', '_1', 'B', 'a', 'r', '\n',
              'B', 'a', 'z'],
             '\\begin{quotation}\nFoo\nBar\n\\end{quotation}\nBaz'],
  'titled list': [['Gb', 'ob', '\n', '#1', 'Y', 'o', '\n'],
                  '\\begin{enum}[Go]\n\\item Yo\n\\end{enum}'],
  'heading': [['h2', 'A', '\n', '\n', 'B'],
              '\\section*{A}\n\nB'],
  'heading and list': [['h2', 'A', '\n', '*1', 'B', '\n'],
                       '\\section*{A}\n\\begin{itemz}\n\\item B\n\\end{itemz}'],
  'nl in list': [['*1', 'F', 'o', 'o', ' n0', 'b', 'a', 'r', '\n'],
                 '\\begin{itemz}\n\\item Foo\nbar\n\\end{itemz}'],
  'nl in list indent': [['*1', 'F', 'o', 'o', ' n2', 'b', 'a', 'r', '\n'],
                 '\\begin{itemz}\n\\item Foo\n  bar\n\\end{itemz}'],
  'titled list with space':
  [['Wb', 'ib', 'sb', 'hb', ' ', '\n', '*1', 'F', 'o', 'o', '\n'],
   '\\begin{itemz}[Wish] \n\\item Foo\n\\end{itemz}'],
  'indented titled list':
  [[' ', ' ', '\\', 'b', 'e', 'g', 'i', 'n', '{', 'i', 't', 'e', 'm', 'z', '}',
    '[', 'F', 'o', 'o', ']', '\n',
    ' ', ' ', '\\', 'i', 't', 'e', 'm', ' ', 'B', 'a', 'r', '\n',
    ' ', ' ', '\\', 'e', 'n', 'd', '{', 'i', 't', 'e', 'm', 'z', '}', '\n'],
   '  \\begin{itemz}[Foo]\n  \\item Bar\n  \\end{itemz}\n'],
  'indented titled list 2':
  [[' ', ' ', '\\', 'b', 'e', 'g', 'i', 'n', '{', 'i', 't', 'e', 'm', 'z', '}',
    '[', 'F', 'o', 'o', ']', '\n',
    ' ', ' ', '\\', 'i', 't', 'e', 'm', 'Bb', 'ab', 'rb', '\n',
    ' ', ' ', '\\', 'e', 'n', 'd', '{', 'i', 't', 'e', 'm', 'z', '}', '\n'],
   '  \\begin{itemz}[Foo]\n  \\item\\textbf{Bar}\n  \\end{itemz}\n'],
  'titled list with indented items':
  [[ 'Gb', 'ob', 'ab', 'lb', 'sb', '\n',
     '*1', 'T', '\n',
     '*1', 'G', '\n',
     '*1', 'W', '\n',],
   '\\begin{itemz}[Goals]\n  \\item T\n\\item G\n\\item W\n\\end{itemz}',
   null,
   '\\begin{itemz}[Goals]\n\\item T\n\\item G\n\\item W\n\\end{itemz}'],
  'titled list with running items':
  [[ 'Gb', 'ob', 'ab', 'lb', 'sb', '\n',
     '*1', 'T', ' ', '\n',
     '*1', 'G', '\n',
     '*1', 'W', '\n',],
   '\\begin{itemz}[Goals]\n  \\item T \\item G\\item W\n\\end{itemz}',
   null,
   '\\begin{itemz}[Goals]\n\\item T \n\\item G\n\\item W\n\\end{itemz}'],
  'ellipsis': [['…'], '\\ldots{}'],
  'fake ellipsis': [['.', '.', '.'], '\\ldots{}', ['…']],
  'fancy double quotes': [['“', 'F', 'o', 'o', '”'], "``Foo''"],
  'fancy single quotes': [['‘', 'F', 'o', 'o', '’'], "`Foo'"],
  'auto quotes': [['"', 'F', 'o', 'o', ',', '"', ' ', 'b', 'a', 'r', ' ', '"',
                   'b', 'a', 'z', '"', '.'],
                  "``Foo,'' bar ``baz''.",
                  ['“', 'F', 'o', 'o', ',', '”', ' ', 'b', 'a', 'r', ' ', '“',
                   'b', 'a', 'z', '”', '.']],
  'presmart stays smart': [['’', 't', 'w', 'a', 's'], "'twas"],
  'dashes and hyphens': [['9', '–', '5', 'p', '-', 'j', '—'], "9--5p-j---"],
  'accent' : [['s', 'í'], "s\\'{i}"],
  'underscore': [['z', '_', 'z'], "z\\_z"],
  'underscore empty arg': [['z', '_{', 'z'], "z\\_{}z"],
};
       
describe('texToTaggedChars', function () {
  for (var key in CASES) {
    var tchars;
    if (CASES[key].length > 2 && CASES[key][2]) {
      tchars = CASES[key][2];
    } else {
      tchars = CASES[key][0];
    }
    it(key, function (tchars, tex) {
      assert.deepEqual(util.texToTaggedChars(tex), tchars);
    }.bind(null, tchars, CASES[key][1]));
  }
});

describe('taggedCharsToTex', function () {
  for (var key in CASES) {
    var tex;
    if (CASES[key].length > 3) {
      tex = CASES[key][3];
    } else {
      tex = CASES[key][1];
    }
    it(key, function (tchars, tex) {
      assert.deepEqual(util.taggedCharsToTex(tchars), tex);
    }.bind(null, CASES[key][0], tex));
  }
});

describe('makeChangesetFromTaggedChars', function () {
  for (var key in CASES) {
    it(key, function (tchars) {
      var pool = new AttributePool;
      var cs = util.makeChangeset('', tchars, pool);
      var atext = {text: '', attribs: ''};
      var new_atext = Changeset.applyToAText(cs, atext, pool);
      var pad = {text: function () { return new_atext.text; },
                 atext: new_atext,
                 apool: function () { return pool; }}
      assert.deepEqual(util.atextToTaggedChars(pad, false), tchars);
    }.bind(null, CASES[key][0]));
  }
});

describe('fileCasesValidate', function () {
  var files = fs.readdirSync(__dirname + '/cases');
  for (var i = 0; i < files.length; ++i) {
    if (files[i].slice(-1) == '~') {
      continue;
    }
    it(files[i], function (file) {
      var data = fs.readFileSync(__dirname + '/cases/' + file, 'utf-8');
      var tchars = util.texToTaggedChars(data);
      //assert.deepEqual(util.taggedCharsToTex(tchars), data);
      var cs = util.makeChangeset('', tchars, new AttributePool);
      Changeset.applyToText(cs, '');
    }.bind(null, files[i]));
  }
});

var SANITIZE_CASES = {
  'balanced': ['\\icard{Foo}{}{}', '\\icard{Foo}{}{}'],
  'icard end missing': ['\\icard{Foo}{}{', '\\icard{Foo}{}{}'],
  'spaces': ['\\icard{Foo}{}{   ', '\\icard{Foo}{}{}   '],
  'nl': ['\\icard{Foo}{}{\n   ', '\\icard{Foo}{}{}\n   '],
  'extra': ['\\icard{Foo}{}{}}', '\\icard{Foo}{}{}'],
  'extra mid': ['\\icard{Foo}}{}{}}', '\\icard{Foo}{}{}'],
};
describe('sanitizeTex', function () {
  for (var key in SANITIZE_CASES) {
    it(key, function (input, output) {
      assert.equal(util.sanitizeTex(input), output);
    }.bind(null, SANITIZE_CASES[key][0], SANITIZE_CASES[key][1]));
  }
});
