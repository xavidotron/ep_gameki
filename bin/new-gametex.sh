#!/bin/bash

tempdir="$(mktemp -d)"

svn co "file://`pwd`/repos/$1" "$tempdir"
cd "$tempdir"

gametex="/afs/athena.mit.edu/user/k/e/kenclary/Public/Guild/GameTeX/GameTeX"

cp -R $gametex/* ./

Extras/changeclass.pl . game "$1"

git clone "https://github.com/xavidotron/gameki-tools.git" Gameki

svn add *
svn ci -m 'Initial GameTeX checkout.'

cd
rm -Rf "$tempdir"
