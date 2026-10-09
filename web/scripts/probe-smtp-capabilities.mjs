/**
 * Measure what an SMTP server actually supports, without sending anything.
 *
 * No credentials are needed to read a capability list. Connect, greet, send EHLO,
 * upgrade to TLS if offered, greet again, read EHLO again, and stop. Nothing is
 * authenticated, no envelope is opened and no message can be sent.
 *
 * This answers a narrower question than probe-smtp.mjs: not whether a provider
 * will send to a given recipient, but whether Supabase will be able to talk to it
 * at all. A provider that does not offer STARTTLS on the port Supabase uses, or
 * does not offer an AUTH mechanism the client supports, is ruled out before any
 * account is created.
 *
 *   node scripts/probe-smtp-capabilities.mjs in-v3.mailjet.com:587
 *   node scripts/probe-smtp-capabilities.mjs smtp-relay.brevo.com:587
 */

import net from 'node:net';
import tls from 'node:tls';

const target = process.argv[2] ?? 'in-v3.mailjet.com:587';
const [host, portRaw] = target.split(':');
const port = Number(portRaw ?? 587);

if (!host) {
  console.error('usage: node scripts/probe-smtp-capabilities.mjs <host>:<port>');
  process.exit(1);
}

console.log(`target  ${host}:${port}`);
console.log('sending nothing, authenticating nothing');
console.log('');

let socket;
let stage = 0; // 0 greeting, 1 ehlo, 2 starttls
let buffer = '';
let reply = '';
let firstReply = '';

const send = (line) => {
  console.log(`> ${line}`);
  socket.write(`${line}\r\n`);
};

function drain() {
  let index;
  while ((index = buffer.indexOf('\r\n')) !== -1) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 2);
    if (!/^\d{3}[ -]/.test(line)) continue;

    console.log(`< ${line}`);
    reply += `${reply ? '\n' : ''}${line}`;
    if (line[3] !== ' ') continue;

    const code = Number(line.slice(0, 3));
    const finished = reply;
    reply = '';
    handle(code, finished);
    return;
  }
}

/**
 * The AUTH mechanisms a capability list offers.
 *
 * The mechanism names follow the keyword on the same line, so `AUTH PLAIN LOGIN`
 * lists two mechanisms and not one. Matching `AUTH LOGIN` as a phrase reports LOGIN
 * missing whenever PLAIN comes first, which is exactly how this script first got it
 * wrong: the transcript said LOGIN and the report said no.
 */
function authMechanisms(capabilities) {
  const found = new Set();
  for (const line of capabilities.split('\n')) {
    const match = line.match(/^\d{3}[ -]AUTH\s*=?\s*(.*)$/i);
    if (!match) continue;
    for (const token of match[1].trim().split(/\s+/)) {
      if (token) found.add(token.toUpperCase());
    }
  }
  return found;
}

function report(label, capabilities, { upgraded = false } = {}) {
  const auth = authMechanisms(capabilities);
  const size = capabilities.match(/SIZE\s+(\d+)/i);

  console.log('');
  console.log(`  ${label}`);
  console.log(
    `    STARTTLS           : ${
      upgraded ? 'already upgraded to TLS' : /^\d{3}[ -]STARTTLS/im.test(capabilities) ? 'offered' : 'NOT OFFERED'
    }`,
  );
  console.log(`    AUTH PLAIN         : ${auth.has('PLAIN') ? 'yes' : 'NO'}`);
  console.log(`    AUTH LOGIN         : ${auth.has('LOGIN') ? 'yes' : 'no'}`);
  console.log(`    AUTH CRAM-MD5      : ${auth.has('CRAM-MD5') ? 'yes' : 'no'}`);
  console.log(`    8BITMIME           : ${/8BITMIME/i.test(capabilities) ? 'yes' : 'no'}`);
  console.log(`    max message size   : ${size ? Number(size[1]).toLocaleString() : 'unadvertised'}`);

  if (!auth.has('PLAIN')) {
    console.log('');
    console.log('    Supabase authenticates with AUTH PLAIN, so this server could not');
    console.log('    be used even with valid credentials.');
  }
}

function finish() {
  console.log('');
  console.log('Connection closed. No credentials were sent and no message exists.');
  socket.end();
  setTimeout(() => process.exit(0), 200);
}

function handle(code, capabilities) {
  if (stage === 0) {
    if (code !== 220) {
      console.log(`\nunexpected greeting: ${code}`);
      return finish();
    }
    stage = 1;
    send('EHLO vendra.probe');
    return;
  }

  if (stage === 1) {
    if (code !== 250) {
      console.log(`\nEHLO refused: ${code}`);
      return finish();
    }
    firstReply = capabilities;

    if (port !== 465 && /STARTTLS/i.test(capabilities)) {
      stage = 2;
      send('STARTTLS');
      return;
    }

    if (port !== 465) {
      console.log('\nno STARTTLS on this port, and the port is not 465');
      report('capabilities (cleartext)', firstReply);
      return finish();
    }

    report('capabilities (cleartext)', firstReply);
    return finish();
  }

  if (stage === 2) {
    if (code !== 220) {
      console.log(`\nSTARTTLS refused: ${code}`);
      return finish();
    }
    const plainSocket = socket;
    plainSocket.removeAllListeners();
    socket = tls.connect(
      { socket: plainSocket, servername: host, rejectUnauthorized: true },
      () => {
        console.log('  [TLS established]');
        stage = 3;
        send('EHLO vendra.probe');
      },
    );
    attach(socket);
    buffer = '';
    reply = '';
    return;
  }

  if (stage === 3) {
    report('capabilities inside TLS', capabilities, { upgraded: true });
    return finish();
  }
}

function attach(sock) {
  sock.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    drain();
  });
  sock.on('error', (error) => {
    console.log(`connection failed: ${error.message}`);
    process.exit(1);
  });
  sock.on('close', () => process.exit(0));
}

socket =
  port === 465
    ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
    : net.connect({ host, port });
attach(socket);

setTimeout(() => {
  console.log('\ntimed out');
  socket.destroy();
  process.exit(1);
}, 30_000);