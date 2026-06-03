import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preferredPorts = [8080, 8081, 8082, 5173, 3000];
const shouldOpenBrowser = !process.argv.includes('--no-open');

const port = await findOpenPort(preferredPorts);
const url = `http://127.0.0.1:${port}/`;

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
});

server.on('exit', (code) => {
  process.exit(code ?? 0);
});

setTimeout(() => {
  if (shouldOpenBrowser) {
    const opener = process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];

    spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
  }

  console.log(`\nLocal preview: ${url}`);
  console.log('Press Ctrl+C to stop the preview server.\n');
}, 600);

process.on('SIGINT', () => {
  server.kill('SIGINT');
});

async function findOpenPort(ports) {
  for (const candidate of ports) {
    if (await isOpen(candidate)) return candidate;
  }
  throw new Error(`No open preview port found. Tried: ${ports.join(', ')}`);
}

function isOpen(port) {
  return new Promise((resolveOpen) => {
    const tester = createServer();
    tester.once('error', () => resolveOpen(false));
    tester.once('listening', () => {
      tester.close(() => resolveOpen(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}
