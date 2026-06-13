#!/usr/bin/env bash
# Capture a screenshot of the currently-booted iOS simulator.
#
# Usage: ./scripts/screenshot.sh <name>   ->  writes /tmp/native-<name>.png
#
# Part of the per-screen Definition of Done: after wiring a screen into the
# native shell, boot it on the simulator and snapshot it for visual review.
set -euo pipefail

name="${1:-screen}"
out="/tmp/native-${name}.png"

xcrun simctl io booted screenshot "$out"
echo "wrote ${out}"
