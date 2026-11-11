#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = { port: 4177, viewport: '1440x900', caps: [] };

for (let index = 0; index < args.length; index += 1) {
  const [name, inlineValue] = args[index].split('=', 2);
  const value = inlineValue ?? args[index + 1];
  if (name === '--help' || name === '-h') {
    console.log('Usage: npm run qa:mcp -- [--port 4177] [--viewport 1440x900] [--caps=vision]');
    console.log('JSONL input: {"tool":"browser_navigate","arguments":{"url":"http://127.0.0.1:4177/"}}');
    process.exit(0);
  }
  if (name === '--port') {
    options.port = Number(value);
    if (inlineValue === undefined) index += 1;
    continue;
  }
  if (name === '--viewport') {
    options.viewport = value;
    if (inlineValue === undefined) index += 1;
    continue;
  }
  if (name === '--caps') {
    options.caps = String(value).split(',').filter(Boolean);
    if (inlineValue === undefined) index += 1;
    continue;
  }
  throw new Error(`Unknown option: ${args[index]}`);
}

if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535)
  throw new Error('--port must be an available TCP port from 1024 to 65535');
if (!/^\d{2,5}x\d{2,5}$/.test(options.viewport))
  throw new Error('--viewport must use WIDTHxHEIGHT, for example 1440x900');
if (options.caps.some(capability => capability !== 'vision'))
  throw new Error('Only the opt-in --caps=vision capability is supported');

const [width, height] = options.viewport.split('x').map(Number);
const sessionId = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const sessionDir = path.join(root, 'work', 'playwright-mcp', sessionId);
const outputDir = path.join(sessionDir, 'output');
const browserCacheDir = path.join(sessionDir, 'browser-cache');
const xdgCacheDir = path.join(sessionDir, 'cache');
const logPath = path.join(sessionDir, 'session.jsonl');
const configPath = path.join(sessionDir, 'mcp.config.json');
const dbPath = path.join(sessionDir, 'rpg.sqlite');
const appUrl = `http://127.0.0.1:${options.port}`;
const serverPath = path.join(root, 'node_modules', '@playwright', 'mcp', 'cli.js');
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(browserCacheDir, { recursive: true });
await fs.mkdir(xdgCacheDir, { recursive: true });

let appServer;
let transport;
let client;
let input;
let stopping = false;
let hadFailure = false;
let commandCount = 0;
let imageCount = 0;
let queue = Promise.resolve();

async function record(event) {
  await fs.appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function writeLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function parseViewport() {
  return { width, height };
}

async function waitForAppReady(child, url) {
  const marker = `RPG + SQLite http://127.0.0.1:${options.port}`;
  let startupOutput = '';
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onData = chunk => {
      startupOutput += chunk.toString();
      if (startupOutput.includes(marker)) finish();
    };
    const onExit = (code, signal) => finish(new Error(`Local dev server exited before listening (code ${code}, signal ${signal})`));
    const onError = error => finish(error);
    const timeout = setTimeout(() => finish(new Error(`Local dev server did not report ready within 15 seconds at ${url}`)), 15000);
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
    if (child.exitCode !== null) onExit(child.exitCode, child.signalCode);
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Local dev server returned HTTP ${response.status} at ${url}`);
}

function appServerArgs() {
  return [path.join(root, 'server', 'dev.mjs')];
}

async function startApp() {
  appServer = spawn(process.execPath, appServerArgs(), {
    cwd: root,
    env: { ...process.env, PORT: String(options.port), RPG_DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  appServer.stdout.on('data', chunk => process.stderr.write(`[app] ${chunk}`));
  appServer.stderr.on('data', chunk => process.stderr.write(`[app:error] ${chunk}`));
  appServer.on('error', error => {
    hadFailure = true;
    void record({ type: 'app-server-error', error: error.message });
  });
  appServer.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      hadFailure = true;
      void record({ type: 'app-server-exit', code, signal });
    }
  });
  await waitForAppReady(appServer, `${appUrl}/`);
}

async function startMcp() {
  const config = {
    browser: {
      browserName: 'chromium',
      isolated: true,
      launchOptions: {
        headless: true,
        ...(chromiumPath ? { executablePath: chromiumPath } : {}),
      },
      contextOptions: { viewport: parseViewport() },
    },
    outputDir,
    imageResponses: 'allow',
    filePaths: 'absolute',
    snapshot: { mode: 'full', boxes: true },
    network: { allowedOrigins: [appUrl] },
    console: { level: 'error' },
    timeouts: { action: 10000, navigation: 30000, expect: 10000, settle: 250 },
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const mcpArgs = [serverPath, '--config', configPath, '--headless'];
  if (chromiumPath) mcpArgs.push('--executable-path', chromiumPath);
  if (options.caps.length) mcpArgs.push(`--caps=${options.caps.join(',')}`);

  transport = new StdioClientTransport({
    command: process.execPath,
    args: mcpArgs,
    env: {
      PLAYWRIGHT_BROWSERS_PATH: browserCacheDir,
      XDG_CACHE_HOME: xdgCacheDir,
    },
    cwd: root,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', chunk => process.stderr.write(`[mcp] ${chunk}`));
  transport.onerror = error => {
    hadFailure = true;
    void record({ type: 'mcp-transport-error', error: error.message });
  };
  client = new Client({ name: 'starlight-chronicle-qa', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  await record({
    type: 'tools-list',
    server: '@playwright/mcp@0.0.85',
    sdk: '@modelcontextprotocol/sdk@1.32.2',
    viewport: options.viewport,
    appUrl,
    capabilities: options.caps,
    tools,
  });
  writeLine({
    type: 'connected',
    server: '@playwright/mcp@0.0.85',
    sdk: '@modelcontextprotocol/sdk@1.32.2',
    appUrl: `${appUrl}/`,
    viewport: options.viewport,
    capabilities: options.caps,
    sessionDir,
    tools: tools.map(({ name, description }) => ({ name, description })),
  });
}

function renderContent(content = []) {
  return Promise.all(content.map(async block => {
    if (block.type === 'image' && block.data) {
      imageCount += 1;
      const extension = block.mimeType?.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
      const imagePath = path.join(outputDir, `response-${String(imageCount).padStart(3, '0')}.${extension}`);
      await fs.writeFile(imagePath, Buffer.from(block.data, 'base64'));
      return { type: 'image', mimeType: block.mimeType, path: imagePath };
    }
    if (block.type === 'text') return { type: 'text', text: block.text };
    if (block.type === 'resource_link') return { type: 'resource_link', name: block.name, uri: block.uri };
    if (block.type === 'resource') return { type: 'resource', resource: block.resource };
    return block;
  }));
}

async function handleInput(line) {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    hadFailure = true;
    const event = { type: 'input-error', error: error.message, line };
    await record(event);
    writeLine(event);
    return;
  }

  if (request?.command === 'quit') {
    await record({ type: 'quit-command' });
    input.close();
    return;
  }
  if (request?.command === 'list') {
    try {
      const result = await client.listTools();
      writeLine({ type: 'tools-list', tools: result.tools.map(({ name, description }) => ({ name, description })) });
    } catch (error) {
      hadFailure = true;
      const event = { type: 'tools-list-error', error: error.message };
      await record(event);
      writeLine(event);
    }
    return;
  }
  if (typeof request?.tool !== 'string' || !request.tool) {
    hadFailure = true;
    const event = { type: 'input-error', error: 'Each request needs a non-empty tool name', request };
    await record(event);
    writeLine(event);
    return;
  }

  commandCount += 1;
  const requestId = commandCount;
  await record({ type: 'tool-call', requestId, tool: request.tool, arguments: request.arguments ?? {} });
  try {
    const result = await client.callTool({ name: request.tool, arguments: request.arguments ?? {} });
    const content = await renderContent(result.content);
    const response = {
      type: 'tool-result',
      requestId,
      tool: request.tool,
      isError: result.isError === true,
      content,
      ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
    };
    await record(response);
    writeLine(response);
    if (result.isError === true) hadFailure = true;
  } catch (error) {
    hadFailure = true;
    const event = { type: 'tool-call-error', requestId, tool: request.tool, error: error.message };
    await record(event);
    writeLine(event);
  }
}

async function closeChildren() {
  stopping = true;
  if (client) {
    try { await client.close(); } catch (error) {
      hadFailure = true;
      process.stderr.write(`[client close error] ${error.message}\n`);
    }
  } else if (transport) {
    try { await transport.close(); } catch (error) {
      hadFailure = true;
      process.stderr.write(`[transport close error] ${error.message}\n`);
    }
  }
  if (appServer && appServer.exitCode === null) {
    const stopped = new Promise(resolve => appServer.once('exit', resolve));
    appServer.kill('SIGTERM');
    await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 3000))]);
    if (appServer.exitCode === null) appServer.kill('SIGKILL');
  }
  await record({ type: 'session-close', hadFailure, toolCalls: commandCount });
  process.exitCode = hadFailure ? 1 : 0;
}

try {
  await fs.writeFile(logPath, '');
  await record({
    type: 'session-start',
    node: process.version,
    appUrl: `${appUrl}/`,
    viewport: options.viewport,
    capabilities: options.caps,
    chromiumPath: chromiumPath ?? null,
    sessionDir,
  });
  await startApp();
  await startMcp();
  process.stderr.write('Send one JSON object per line: {"tool":"browser_snapshot","arguments":{}}. Use {"command":"list"} to list tools, {"command":"quit"} or EOF to close.\n');
  input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
  input.on('line', line => {
    queue = queue.then(() => handleInput(line)).catch(async error => {
      hadFailure = true;
      const event = { type: 'client-error', error: error.message };
      await record(event);
      writeLine(event);
    });
  });
  input.on('close', () => {
    queue.then(closeChildren).catch(error => {
      process.stderr.write(`[shutdown error] ${error.message}\n`);
      process.exitCode = 1;
    });
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      if (!stopping) {
        stopping = true;
        input?.close();
      }
    });
  }
} catch (error) {
  hadFailure = true;
  process.stderr.write(`${error.stack ?? error.message}\n`);
  await record({ type: 'startup-error', error: error.message }).catch(() => {});
  await closeChildren();
}
