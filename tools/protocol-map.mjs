#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const mapPath = path.resolve(rootDir, 'docs/protocol-action-mapping.json');

function loadMap() {
  if (!fs.existsSync(mapPath)) {
    console.error(`❌ Mapping file not found at: ${mapPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function saveMap(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(mapPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ Mapping file updated successfully: ${mapPath}`);
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  console.log(`
📖 Protocol Mapping CLI Tool (Privacy Guard)
Usage:
  node tools/protocol-map.mjs list                       List all mapped surfaces and actions
  node tools/protocol-map.mjs get surface <name>         Get details of a surface
  node tools/protocol-map.mjs get action <name>          Get details of an action
  node tools/protocol-map.mjs set-surface <key> <json>   Add or update a surface definition
  node tools/protocol-map.mjs set-action <key> <json>    Add or update an action definition
  node tools/protocol-map.mjs validate                   Validate mapping file integrity
`);
  process.exit(0);
}

const map = loadMap();

if (command === 'list') {
  console.log('\n📱 SURFACES:');
  for (const [k, v] of Object.entries(map.surfaces || {})) {
    console.log(`  • ${k.padEnd(30)} -> ${v.name}`);
  }
  console.log('\n🎯 ACTIONS:');
  for (const [k, v] of Object.entries(map.actions || {})) {
    console.log(`  • ${k.padEnd(30)} -> ${v.description}`);
  }
  console.log('\n🚨 ANOMALIES:');
  for (const [k, v] of Object.entries(map.anomalyDefinitions || {})) {
    console.log(`  • [${v.level}] ${k.padEnd(25)} -> ${v.condition}`);
  }
  console.log();
} else if (command === 'get') {
  const type = args[1];
  const key = args[2];
  if (!type || !key) {
    console.error('❌ Usage: node tools/protocol-map.mjs get <surface|action> <name>');
    process.exit(1);
  }
  if (type === 'surface') {
    const val = map.surfaces?.[key];
    if (!val) {
      console.error(`❌ Surface not found: "${key}". Available: ${Object.keys(map.surfaces || {}).join(', ')}`);
      process.exit(1);
    }
    console.log(JSON.stringify(val, null, 2));
  } else if (type === 'action') {
    const val = map.actions?.[key];
    if (!val) {
      console.error(`❌ Action not found: "${key}". Available: ${Object.keys(map.actions || {}).join(', ')}`);
      process.exit(1);
    }
    console.log(JSON.stringify(val, null, 2));
  } else {
    console.error(`❌ Unknown type "${type}". Use "surface" or "action".`);
    process.exit(1);
  }
} else if (command === 'set-surface') {
  const key = args[1];
  const jsonStr = args[2];
  if (!key || !jsonStr) {
    console.error('❌ Usage: node tools/protocol-map.mjs set-surface <key> <jsonStrOrFile>');
    process.exit(1);
  }
  let payload;
  try {
    payload = fs.existsSync(jsonStr) ? JSON.parse(fs.readFileSync(jsonStr, 'utf8')) : JSON.parse(jsonStr);
  } catch (err) {
    console.error(`❌ Invalid JSON input:`, err.message);
    process.exit(1);
  }
  map.surfaces = map.surfaces || {};
  map.surfaces[key] = payload;
  saveMap(map);
} else if (command === 'set-action') {
  const key = args[1];
  const jsonStr = args[2];
  if (!key || !jsonStr) {
    console.error('❌ Usage: node tools/protocol-map.mjs set-action <key> <jsonStrOrFile>');
    process.exit(1);
  }
  let payload;
  try {
    payload = fs.existsSync(jsonStr) ? JSON.parse(fs.readFileSync(jsonStr, 'utf8')) : JSON.parse(jsonStr);
  } catch (err) {
    console.error(`❌ Invalid JSON input:`, err.message);
    process.exit(1);
  }
  map.actions = map.actions || {};
  map.actions[key] = payload;
  saveMap(map);
} else if (command === 'validate') {
  let errors = 0;
  if (!map.surfaces || typeof map.surfaces !== 'object') {
    console.error('❌ Missing "surfaces" object');
    errors++;
  }
  if (!map.actions || typeof map.actions !== 'object') {
    console.error('❌ Missing "actions" object');
    errors++;
  }
  if (errors === 0) {
    console.log(`✅ Validation passed! Surfaces: ${Object.keys(map.surfaces).length}, Actions: ${Object.keys(map.actions).length}`);
  } else {
    process.exit(1);
  }
} else {
  console.error(`❌ Unknown command: "${command}". Run without args for help.`);
  process.exit(1);
}
