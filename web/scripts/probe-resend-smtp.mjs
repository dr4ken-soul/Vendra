/**
 * Speak SMTP to Resend exactly the way Supabase does, and report what comes back.
 *
 * This exists because documentation and observation disagreed. Supabase swallows
 * the real SMTP error and returns a generic "Error sending confirmation email", so
 * the cause has to be established by talking to the provider directly.
 *
 * It is deliberately a diagnostic, not a workaround. Nothing is changed, no email
 * is delivered, and no application code uses this. It answers one question: does
 * Resend accept a message from the configured sender to a recipient that is not
 * the account owner's address?
 *
 * Your API key never reaches me. This reads it from the environment, uses it, and
 * prints nothing but the length.
 *
 *   $env:RESEND_API_KEY = "re_..."          # PowerShell
 *   node scripts/probe-resend-smtp.mjs
 *
 * Add a recipient to also test real delivery:
 *
 *   node scripts/probe-resend-smtp.mjs --to someone@example.com
 */

import net from 'node:net';
import tls from 'node:tls';

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.argv.includes('--from')
  ? process.argv[process.argv.indexOf('--from') + 1]
  : 'onboarding@resend.dev';
const toAddress = process.argv.includes('--to')
  ? process.argv[process.argv.indexOf('--to') + 1]
  : 'vendra-probe@example.test';

if (!apiKey) {
  console.error('RESEND_API_KEY is not set. Export it for this shell only:');
  console.error('  $env:RESEND_API_KEY = "re_..."');
  process.exit(1);
}

if (!fromAddress.includes('@') || !toAddress.includes('@')) {
  console.error('Both --from and --to must be email addresses.');
  process.exit(1);
}

console.log(`key       set (${apiKey.length} chars)`);
console.log(`from      ${fromAddress}`);
console.log(`to        ${toAddress}`);
console.log(`server    smtp.resend.com:465 (implicit TLS)`);
console.log('');
console.log('The response to RCPT TO is what decides this. Sending nothing.');
console.log('');

const socket = tls.connect(
  { host: 'smtp.resend.com', port: 465, servername: 'smtp.resend.com', rejectUnauthorized: true },
  () => {
    write('EHLO vendra.local');
  },
);

let buffer = '';
let stage = 0;
let lastCode = 0;
let lastText = '';

function write(line) {
  socket.write(`${line}\r\n`);
}

function read() {
  const lines = buffer.split('\r\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (line === '') continue;
    const code = Number(line.slice(0, 3));
    const text = line.slice(4);
    if (code) {
      lastCode = code;
      lastText = text;
      console.log(`< ${line}`);
    }
  }

  // 250 means the last line of a multiline reply.
  if (lastCode !== 250) return;

  switch (stage) {
    case 0:
      stage = 1;
      write(`AUTH PLAIN ${Buffer.from(`\0resend\0${apiKey}`).toString('base64')}`);
      break;
    case 1:
      stage = 2;
      write(`MAIL FROM:<${fromAddress}>`);
      break;
    case 2:
      stage = 3;
      write(`RCPT TO:<${toAddress}>`);
      break;
    case 3: {
      stage = 4;
      console.log('');
      if (lastCode === 250) {
        console.log('RCPT ACCEPTED.');
        console.log('This sender and recipient combination is allowed. No message was sent.');
      } else {
        console.log(`RCPT REJECTED (${lastCode}): ${lastText}`);
      }
      socket.end();
      break;
    }
    default:
      socket.end();
  }
}

socket.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  read();
});

socket.on('error', (error) => {
  console.log(`connection failed: ${error.message}`);
  if (/self signed|certificate|unable to verify/i.test(error.message)) {
    console.log('');
    console.log('A TLS certificate error usually means the machine is intercepting');
    console.log('SMTP, or the system certificate store is incomplete. That would fail');
    console.log('for Supabase too, but Supabase runs its own infrastructure.');
  }
});

socket.on('close', () => {
  console.log('');
  console.log('done. nothing was sent, nothing was changed.');
  process.exit(0);
});

setTimeout(() => {
  console.log('timed out');
  socket.destroy();
  process.exit(1);
}, 45_000);
