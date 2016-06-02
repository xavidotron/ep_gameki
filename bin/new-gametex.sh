#!/bin/bash

set -e

tempdir="$(mktemp -d)"

svn co "file://`pwd`/repos/$1" "$tempdir"
cd "$tempdir"

gametex="http://web.mit.edu/kenclary/Public/Guild/GameTeX/gametex.tar.bz2"

curl "$gametex" -o gametex.tar.bz2
tar --strip-components=1 -xf gametex.tar.bz2
rm gametex.tar.bz2

Extras/changeclass.pl . game "$1"

git clone "https://github.com/xavidotron/gameki-tools.git" Gameki

svn add *
svn ci -m 'Initial GameTeX checkout.'

cd
rm -Rf "$tempdir"
