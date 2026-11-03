#!/usr/bin/env node
'use strict';
require('../lib/cli').run(process.argv.slice(2), { mcp: true, version: require('../package.json').version });
