#!/bin/sh

TEMP="$(mktemp -d)"

#
# remove the useless animate.css
#
ANIMATE="./public/animate.css"

# move out the stuff we want
mv "$ANIMATE/animate.min.css" "$TEMP/"

# nuke animate.css directory
rm -r $ANIMATE/*
rm -r $ANIMATE/.*

# move back the stuff we want
mv $TEMP/* $ANIMATE/
mv $TEMP/.* $ANIMATE/

#
# remove the useless mathjax files
#
rm -r ./node_modules/mathjax-full/  # just nuke the source directory
MATHJAX="./public/mathjax/es5"

# move out the stuff we want
mv "$MATHJAX/tex-chtml.js" "$TEMP/"

mkdir -p "$TEMP/input/tex"
mv "$MATHJAX/input/tex/extensions" "$TEMP/input/tex/"

mkdir -p "$TEMP/output/chtml/fonts"
mv "$MATHJAX/output/chtml/fonts/woff-v2" "$TEMP/output/chtml/fonts/"

mv "$MATHJAX/a11y" "$TEMP/"
mv "$MATHJAX/sre" "$TEMP/"

# nuke mathjax directory
rm -r $MATHJAX/*
rm -r $MATHJAX/.*

# move back the stuff we want
mv $TEMP/* $MATHJAX/
mv $TEMP/.* $MATHJAX/
