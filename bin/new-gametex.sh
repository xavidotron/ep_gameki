#!/bin/bash

tempdir="$(mktemp -d)"

svn co "file:///home/etherpad/repos/$1" "$tempdir"
cd "$tempdir"

gametex="/afs/athena.mit.edu/user/k/e/kenclary/Public/Guild/GameTeX/GameTeX"

cp -R $gametex/* ./

Extras/changeclass.pl . game "$1"

svn add *
svn ci -m 'Initial GameTeX checkout.'

cd
rm -Rf "$tempdir"
