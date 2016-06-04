#!/bin/bash

set -e

# add-mit.sh project repo username password

svn co "file:///mit/$2" checkouts/"$1"

echo "$3 = $4" > passwd/"$1"
