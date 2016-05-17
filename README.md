# Gameki

## About Gameki 2

Gameki is an online interface for collaboratively editing LARPs, allowing multiple GMs to contribute without getting in each other's way.

### Features

* Interactive, real-time collaborative editing in your web browser, powered by [Etherpad Lite](http://etherpad.org/).
* Based on [GameTeX](http://web.mit.edu/kenclary/Public/Guild/GameTeX/) for powerful parameterization abilities and full GameTeX compatibility.
* Automatic Subversion syncing: GMs can edit with Subversion and a text editor if they wish.
* See and edit sheet metadata alongside the sheet text.
* Send casting hint or packet emails, prod sheets, and do interactive casting (via [Gameki Tools](http://xavidotron.github.io/gameki-tools/)).
* Runs on [XVM](http://xvm.mit.edu/) (or presumably any cloud provider).

### Future Features

* Syntax highlighting, with an angry red for non-macro'd pronouns.
* Support for interactive runtime websites.

### Non-Goals

* Keeping Subversion history clean.
* Having a different markup language or data/production model like Gameki 1 did.
* Running on scripts.mit.edu; unfortunately, it's hard to make Etherpad Lite and Scripts play nice.
