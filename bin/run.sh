#!/bin/bash

set -e

while true ; do
    k5start -f "$1" "$2" bin/run.sh
    if [ -n "$3" ] ; then
        zwrite -d -c "$3" -m 'Exited; restarting!'
    fi
done
