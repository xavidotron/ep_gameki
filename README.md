# Gameki

## About Gameki 2

Gameki is an online interface for collaboratively editing LARPs, allowing multiple GMs to contribute without getting in each other's way.

Gameki is in Alpha. It's been used for several games, but still has
rough edges and is undergoing active development. All edits and
history are stored in Subversion, so no content should get lost, but
you may still encounter bugs or missing features.

### Features

* Interactive, real-time collaborative editing in your web browser, powered by [Etherpad Lite](http://etherpad.org/).
* Based on [GameTeX](http://web.mit.edu/kenclary/Public/Guild/GameTeX/) for powerful parameterization abilities and full GameTeX compatibility.
* Automatic Subversion syncing: GMs can edit with Subversion and a text editor if they wish.
* See and edit sheet metadata alongside the sheet text or in table form.
* Send casting hint or packet emails, prod sheets, and do interactive casting (via [Gameki Tools](http://xavidotron.github.io/gameki-tools/)).
* Runs on [XVM](http://xvm.mit.edu/) (or presumably any cloud provider).
* Bi-directional Zephyr/Etherpad chat gateway.
* Easily take GM notes that will be available from Subversion later.
* Paste formatted rich text from another app and have it mostly DTRT.

### Future Features

* Syntax highlighting, with an angry red for non-macro'd pronouns.
* Support for interactive runtime websites.
* Git support, I guess.
* Repository types other than local or AFS.

### Non-Goals

* Keeping Subversion history clean.
* Having a different markup language or data/production model like Gameki 1 did.
* Running on scripts.mit.edu; unfortunately, it's hard to make Etherpad Lite and Scripts play nice.

### Bugs and Issues

See https://github.com/xavidotron/ep_gameki/issues.

## Getting Started

Xavid has a dev server you're welcome to use. Talk to him to get set up. Or
you can run your own server by following the installation and setup instructions
here.

## Installation

These instructions assume a Debian-y Linux server, but can probably work with
other systems.

Note that we here use my patched version of Etherpad Lite. Once my pull requests
get merged, we can go back to the upstream version.

```bash
$ sudo apt-get update
$ sudo apt-get install npm subversion texlive-latex-base texlive-latex-extra \
    texlive-fonts-recommended texlive-xetex latexmk texlive-luatex git curl \
    nodejs nodejs-legacy
$ git clone https://github.com/xavidotron/etherpad-lite.git
$ mkdir etherpad-lite/src/node_modules
$ cd etherpad-lite/src/node_modules
$ git clone https://github.com/xavidotron/yajsml.git etherpad-yajsml
$ cd ../..
$ npm install queue-async underscore.string synchronized escape-regexp js-yaml \
    findit deep-equal temp is-binary-path jsdifflib unorm body-parser \
    cookie-parser
$ cd node_modules
$ git clone https://github.com/xavidotron/ep_bazki.git
$ git clone https://github.com/xavidotron/ep_gameki.git
$ cd ..
$ mkdir checkouts repos workdirs passwd
```

For Zephyr support, additionally:

```bash
$ sudo apt-get install zephyr-clients krb5-user tzc libzephyr4-krb5 kstart
```

## Running

### Without Zephyr

If running without Zephyr, you can just use the normal Etherpad run script:

```bash
$ while true ; do bin/run.sh ; done
```

### With Zephyr

If you want to use the Zephyr support, you first need a keytab.  You
can get a daemon keytab for a host you own by emailing
accounts@mit.edu.

You may want errors to get sent to a particular Zephyr class. To
achieve this, add something like the following to the "appenders"
block of settings.json:

```json
      , { "type": "logLevelFilter"
        , "level": "warn"
        , "appender":
          {  "type": "ep_gameki/zwrite_appender"
             , "suppress": "Authentication try failed"
             , "zephyr_class": "your-spew-class"
          }
        }
```

Substitute the path and principle of your keytab, and optionally a
zephyr class for restart notifications, in the below command:

```bash
$ node_modules/ep_gameki/bin/run.sh ~/Private/bazki.keytab \
    daemon/bazki.mit.edu your-spew-class
```
