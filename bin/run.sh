#!/bin/bash

set -e

while true ; do
    k5start -f ~/Private/bazki.keytab daemon/bazki.mit.edu bin/run.sh
    zwrite -d -c gameki-spew -m 'Exited; restarting!'
done
