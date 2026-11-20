#!/usr/bin/env bash
# Download the public raw datasets into data-raw/ (not committed). Then run: npm run data
set -euo pipefail
mkdir -p data-raw && cd data-raw
HB=https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson
for y in bc3000 bc2000 bc1500 bc1000 bc700 bc500 bc400 bc323 bc300 bc200 bc100 bc1 100 200 300 400 500 600 700 800 900 1000 1100 1200 1279 1300 1400 1500 1530 1600 1650 1700 1715 1783 1800 1815 1880 1900 1914 1920 1930 1938 1945 1960 1994 2010; do
  [ -f world_$y.geojson ] || curl -fsSO $HB/world_$y.geojson
done
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_50m_admin_0_countries ne_50m_land ne_50m_rivers_lake_centerlines ne_110m_admin_0_countries; do
  [ -f $f.geojson ] || curl -fsSO $NE/$f.geojson
done
echo done
