/**
 * Speak SMTP to Resend exactly the way Supabase does, and report what comes back.
 *
 * This exists because documentation and observation disagreed. Supabase swallows
 * the real SMTP error and returns a generic "Error sending confirmation email", so
 * the cause has to be established by talking to the provider directly.
 *
 * It is deliberately a diagnostic, not a workaround. Nothing is changed and no
 * message is delivered. It answers one question: does Resend accept a message from
 * the configured sender to a recipient that is not the account owner's address?
 *
 * Your API key never has to be shared. This reads it from the environment and
 * prints nothing but its length.
 *
 *   $env:RESEND_API_KEY = "re_..."          # PowerShell
 *   node scripts/probe-resend-smtp.mjs
 *   node scripts/probe-resend-smtp.mjs --from no-reply@yourdomain.com
 *
 * Protocol notes, because getting this wrong produces a misleading answer:
 *
 *   - The server speaks first. Sending anything before the 220 greeting earns a
 *     421 "You talk too soon", which says nothing about the sender.
 *   - Replies are multi-line. The response code is on the final line, which is the
 *     one with a space after the code rather than a hyphen.
 */

import tls from 'node:tls';

const apiKey = process.env.RESEND_API_KEY;
const argOf = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const fromAddress = argOf('--from') ?? 'onboarding@resend.dev';
const toAddress = argOf('--to') ?? 'vendra-probe@example.test';

if (!apiKey) {
  console.error('RESEND_API_KEY is not set. Export it for this shell only:');
  console.error('  $env:RESEND_API_KEY = "re_..."');
  process.exit(1);
}

for (const [label, value] of [
  ['--from', fromAddress],
  ['--to', toAddress],
]) {
  if (!/^[^@\s]+@[^@\s]+$/.test(value)) {
    console.error(`${label} must be an email address, got "${value}".`);
    process.exit(1);
  }
}

console.log(`key       set (${apiKey.length} chars)`);
console.log(`from      ${fromAddress}`);
console.log(`to        ${toAddress}`);
console.log(`server    smtp.resend.com:465 (implicit TLS)`);
console.log('');

const socket = tls.connect({
  host: 'smtp.resend.com',
  port: 465,
  servername: 'smtp.resend.com',
  rejectUnauthorized: true,
});

/** 0 greeting, 1 ehlo, 2 auth, 3 mail from, 4 rcpt to */
let stage = 0;
let buffer = '';
let code = 0;
let message = '';
let capabilities = '';

const send = (line) => {
  console.log(`> ${line.replace(/AUTH PLAIN .*/, 'AUTH PLAIN [redacted]')}`);
  socket.write(`${line}\r\n`);
};

/**
 * Consume complete replies.
 *
 * A reply ends at a line shaped `NNN ` — three digits then a space. Lines ending
 * in `-` are continuations. Anything else is noise.
 */
function drain() {
  let index;
  while ((index = buffer.indexOf('\r\n')) !== -1) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 2);

    if (!/^\d{3}[ -]/.test(line)) continue;

    console.log(`< ${line}`);
    code = Number(line.slice(0, 3));
    message = line.slice(4);

    if (line[3] !== ' ') continue; // continuation line, not the end of the reply

    handle();
    return;
  }
}

function handle() {
  switch (stage) {
    case 0:
      if (code !== 220) {
        console.log(`\nunexpected greeting: ${code} ${message}`);
        return finish();
      }
      stage = 1;
      send('EHLO vendra.probe');
      return;

    case 1: {
      if (code !== 250) {
        console.log(`\nEHLO refused: ${code} ${message}`);
        return finish();
      }
      capabilities = message;
      stage = 2;

      // Resend advertises AUTH PLAIN and AUTH LOGIN. PLAIN is one round trip.
      if (/AUTH\s+PLAIN/i.test(capabilities)) {
        send(`AUTH PLAIN ${Buffer.from(`\0resend\0${apiKey}`).toString('base64')}`);
      } else if (/AUTH\s+LOGIN/i.test(capabilities)) {
        stage = 2.5;
        send('AUTH LOGIN');
      } else {
        console.log('\nthe server offers no AUTH mechanism it will accept');
        return finish();
      }
      return;
    }

    case 2.5: {
      if (code !== 334) {
        console.log(`\nAUTH LOGIN refused: ${code} ${message}`);
        return finish();
      }
      // 334 VXNlcm5hbWU6 -> username
      send(Buffer.from('resend').toString('base64'));
      stage = 2.6;
      return;
    }

    case 2.6: {
      if (code !== 334) {
        console.log(`\nAUTH LOGIN refused at the password step: ${code} ${message}`);
        return finish();
      }
      send(Buffer.from(apiKey).toString('base64'));
      stage = 2.7;
      return;
    }

    case 2.7:
      if (code !== 235) {
        console.log(`\nauthentication failed: ${code} ${message}`);
        console.log('The API key was rejected. Check it exists, is not revoked, and');
        console.log('belongs to this Resend account.');
        return finish();
      }
      stage = 3;
      send(`MAIL FROM:<${fromAddress}>`);
      return;

    case 2:
      if (code !== 235) {
        console.log(`\nauthentication failed: ${code} ${message}`);
        console.log('The API key was rejected. Check it exists, is not revoked, and');
        console.log('belongs to this Resend account.');
        return finish();
      }
      stage = 3;
      send(`MAIL FROM:<${fromAddress}>`);
      return;

    case 3:
      if (code !== 250) {
        console.log(`\nMAIL FROM refused: ${code} ${message}`);
        console.log('The sender address itself was rejected.');
        return finish();
      }
      stage = 4;
      send(`RCPT TO:<${toAddress}>`);
      return;

    case 4:
      console.log('');
      if (code === 250 || code === 251) {
        console.log('RCPT ACCEPTED.');
        console.log(`Resend would accept ${fromAddress} -> ${toAddress}.`);
        console.log('So the sender is not the problem, and the sign-up failure has a');
        console.log('different cause.');
      } else {
        console.log(`RCPT REJECTED: ${code} ${message}`);
        console.log('The sender cannot reach this recipient, which is what stops');
        console.log('sign-up working for anyone who is not the account owner.');
      }
      console.log('');
      console.log('No message was sent and nothing was changed.');
      return finish();

    default:
      return finish();
  }
}

function finish() {
  socket.end();
}

socket.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  drain();
});

socket.on('error', (error) => {
  console.log(`connection failed: ${error.message}`);
  if (/self signed|certificate|unable to verify|wrong version/i.test(error.message)) {
    console.log('');
    console.log('A TLS verification failure means this machine is intercepting SMTP or');
    console.log('its certificate store is incomplete. That would not affect Supabase,');
    console.log('which runs its own infrastructure, so it would not explain the');
    console.log('sign-up failure — but it does mean this probe cannot answer the');
    console.log('question on this machine.');
  }
  process.exit(1);
});

socket.on('close', () => process.exit(0));

setTimeout(() => {
  console.log('\ntimed out');
  socket.destroy();
  process.exit(1);
}, 45_000);
