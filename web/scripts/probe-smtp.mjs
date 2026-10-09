/**
 * Speak SMTP the way Supabase does, and report what comes back.
 *
 * Supabase swallows the provider's error and returns a generic
 * "Error sending confirmation email", so the cause has to be established by
 * talking to the provider directly. This is a diagnostic, not a workaround.
 *
 * The password never has to be shared. It is read from the environment and only
 * its length is printed.
 *
 *   $env:RESEND_API_KEY = "re_..."              # PowerShell, name is historical
 *   node scripts/probe-smtp.mjs                 # Resend, port 465
 *   node scripts/probe-smtp.mjs --port 587 --data
 *   node scripts/probe-smtp.mjs --host smtp.gmail.com --user you@gmail.com \
 *                             --port 587 --from you@gmail.com --data
 *
 * Any provider can be measured this way. --host and --user exist so a candidate
 * can be tested before anything is committed to it, rather than adopted on the
 * strength of a pricing page. The environment variable is still called
 * RESEND_API_KEY because that is what the shell already had set.
 *
 * Protocol notes, because getting this wrong produces a misleading answer:
 *
 *   - The server speaks first. Sending anything before the 220 greeting earns a
 *     421 "You talk too soon", which says nothing about the sender.
 *   - Replies are multi-line. The response code is on the final line, the one
 *     with a space after the code rather than a hyphen, which is where the
 *     EHLO capability list lives.
 *   - On 587 the connection starts in the clear and is upgraded with STARTTLS.
 *     The server may then greet again or say nothing and wait, so EHLO goes out
 *     as soon as the handshake completes.
 *   - Nothing is sent unless --data is passed, and RCPT TO is not the answer.
 *     RCPT TO proves the envelope was accepted; several providers defer the real
 *     recipient question to DATA. Stopping early is how this script once reported
 *     that a test sender could reach anyone.
 */

import net from 'node:net';
import tls from 'node:tls';

const apiKey = process.env.RESEND_API_KEY;
const argOf = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const port = Number(argOf('--port') ?? 465);
const fromAddress = argOf('--from') ?? 'onboarding@resend.dev';
const toAddress = argOf('--to') ?? 'vendra-probe@example.test';
const sendData = process.argv.includes('--data');

/**
 * Any provider, not just Resend.
 *
 * The blocker is the same wherever it is configured: does this server accept a
 * message from this sender to this recipient? That question is asked over SMTP,
 * and SMTP does not care whose server it is. So --host and --user exist so that
 * a candidate can be measured before anything is committed to it, instead of
 * being adopted on the strength of a pricing page.
 */
const host = argOf('--host') ?? 'smtp.resend.com';
const user = argOf('--user') ?? 'resend';

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

if (port !== 465 && port !== 587) {
  console.error(`--port must be 465 or 587, got ${port}.`);
  process.exit(1);
}

const implicitTls = port === 465;

console.log(`password  set (${apiKey.length} chars)`);
console.log(`user      ${user}`);
console.log(`from      ${fromAddress}`);
console.log(`to        ${toAddress}`);
console.log(`server    ${host}:${port} (${implicitTls ? 'implicit TLS' : 'STARTTLS'})`);
console.log(`body      ${sendData ? 'sent - this delivers a real message' : 'not sent'}`);
console.log('');

/**
 * A body shaped like what Supabase actually submits.
 *
 * The From header must be the same address as the MAIL FROM envelope sender.
 * Providers check the two against each other, so a header naming a different
 * address is rejected with 550 even when the envelope was accepted, and the
 * rejection says nothing about the account or the credentials.
 */
const message = [
  `From: Vendra <${fromAddress}>`,
  `To: ${toAddress}`,
  'Subject: Your Vendra sign-up code',
  'Date: Thu, 09 Oct 2026 12:00:00 +0000',
  'Message-ID: <probe@vendra.local>',
  'Content-Type: text/html; charset=UTF-8',
  '',
  '<p>Your sign-up code is <strong>123456</strong>.</p>',
  '',
].join('\r\n');

let stage = 0;
let buffer = '';
/** True once STARTTLS has been issued, so the upgrade is never attempted twice. */
let upgraded = false;
/** True once the encrypted channel is live, so a re-greeting can be recognised. */
let afterTls = false;
let code = 0;
let message_ = '';
/**
 * Every line of the current reply, joined.
 *
 * Capabilities arrive as a multi-line reply and AUTH is usually not on the last
 * line, so keeping only the final line loses it. An earlier version of this probe
 * did exactly that and then reported that Resend offered no AUTH mechanism, which
 * was false: Resend had advertised AUTH PLAIN LOGIN two lines up.
 */
let reply = '';

let socket;

const send = (line) => {
  console.log(`> ${line.replace(/AUTH PLAIN .*/, 'AUTH PLAIN [redacted]')}`);
  socket.write(`${line}\r\n`);
};

const plain = (line) => socket.write(`${line}\r\n`);

/**
 * Escape a body so its own periods cannot be read as the end-of-data marker.
 *
 * RFC 5321 requires a period at the *start* of a line to be doubled, and nothing
 * else. Replacing every period in the body also rewrites the domains, so
 * `onboarding@resend.dev` becomes `onboarding@resend..dev` and the server
 * rejects the From header as malformed. That is what an earlier version did, and
 * the resulting 550 said nothing about the account.
 */
function stuffDots(body) {
  return body
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

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
    message_ = line.slice(4);

    // A line ending in `-` continues the reply, so the next line's code is
    // informational rather than the response.
    reply += `${reply ? '\n' : ''}${line}`;

    if (line[3] !== ' ') continue;

    // Hand the complete reply to handle() before resetting, so that EHLO's
    // capability list is still available to the stage that needs it.
    const finished = reply;
    reply = '';
    handle(finished);
    return;
  }
}

function handle(capabilities = '') {
  // A 220 arriving after the STARTTLS upgrade is a re-greeting, not an answer to
  // anything. The EHLO has already gone out, so acknowledge and wait for it.
  if (stage === 1 && afterTls && code === 220) {
    console.log('  [re-greeting received, waiting for the EHLO reply]');
    return;
  }

  switch (stage) {
    case 0:
      if (code !== 220) {
        console.log(`\nunexpected greeting: ${code} ${message_}`);
        return finish();
      }
      stage = 1;
      send('EHLO vendra.probe');
      return;

    case 1: {
      if (code !== 250) {
        console.log(`\nEHLO refused: ${code} ${message_}`);
        return finish();
      }

      // On 587 upgrade first, then greet again on the encrypted channel.
      if (!implicitTls && /STARTTLS/i.test(capabilities) && !upgraded) {
        upgraded = true;
        stage = 1.5;
        send('STARTTLS');
        return;
      }

      if (!implicitTls && !upgraded) {
        console.log('\nthe server does not offer STARTTLS, so 587 cannot be used');
        return finish();
      }

      stage = 2;

      // Search the whole reply, not just its final line. AUTH is a capability and
      // capabilities come back as a multi-line reply.
      if (/^250[- ]AUTH\s+PLAIN\b/im.test(capabilities)) {
        send(`AUTH PLAIN ${Buffer.from(`\0${user}\0${apiKey}`).toString('base64')}`);
      } else if (/^250[- ]AUTH\s+LOGIN\b/im.test(capabilities)) {
        stage = 2.5;
        send('AUTH LOGIN');
      } else {
        console.log('\nthe server advertised no usable AUTH mechanism');
        console.log(`it offered:\n${capabilities}`);
        return finish();
      }
      return;
    }

    case 1.5: {
      if (code !== 220) {
        console.log(`\nSTARTTLS refused: ${code} ${message_}`);
        return finish();
      }
      const plainSocket = socket;
      plainSocket.removeAllListeners();
      socket = tls.connect(
        { socket: plainSocket, servername: host, rejectUnauthorized: true },
        () => {
          console.log('  [TLS established]');
        },
      );
      attach(socket);

      // RFC 3207 lets the server either send a fresh 220 greeting after the
      // handshake or say nothing and wait for the client to speak. Resend does
      // the latter, so waiting for a greeting hangs until the timeout. Send EHLO
      // as soon as the handshake completes, and tolerate a greeting if one
      // arrives anyway.
      socket.once('secureConnect', () => {
        console.log('  [TLS established, no re-greeting expected]');
        afterTls = true;
        stage = 1;
        send('EHLO vendra.probe');
      });
      return;
    }

    case 2.5: {
      if (code !== 334) {
        console.log(`\nAUTH LOGIN refused: ${code} ${message_}`);
        return finish();
      }
      send(Buffer.from(user).toString('base64'));
      stage = 2.6;
      return;
    }

    case 2.6: {
      if (code !== 334) {
        console.log(`\nAUTH LOGIN refused at the password step: ${code} ${message_}`);
        return finish();
      }
      send(Buffer.from(apiKey).toString('base64'));
      stage = 2.7;
      return;
    }

    case 2.7:
      if (code !== 235) {
        return authFailed();
      }
      stage = 3;
      send(`MAIL FROM:<${fromAddress}>`);
      return;

    case 2:
      if (code !== 235) {
        return authFailed();
      }
      stage = 3;
      send(`MAIL FROM:<${fromAddress}>`);
      return;

    case 3:
      if (code !== 250) {
        console.log(`\nMAIL FROM refused: ${code} ${message_}`);
        console.log('The sender address itself was rejected.');
        return finish();
      }
      stage = 4;
      send(`RCPT TO:<${toAddress}>`);
      return;

    case 4:
      console.log('');
      if (code !== 250 && code !== 251) {
        console.log(`RCPT REJECTED: ${code} ${message_}`);
        console.log('The sender cannot reach this recipient.');
        return finish();
      }
      console.log('RCPT ACCEPTED.');
      if (!sendData) {
        console.log('');
        console.log('What this establishes: the credentials work, and the provider');
        console.log('accepted this envelope.');
        console.log('');
        console.log('What it does NOT establish: that the message can be sent.');
        console.log('Many providers answer RCPT TO with 250 and defer the real recipient');
        console.log('check to DATA. A test sender passes this stage and is still');
        console.log('refused at the next one.');
        console.log('');
        console.log('Re-run with --data to submit a body. Until then this run cannot');
        console.log('support any conclusion about who the sender may reach.');
        console.log('');
        console.log('No message was sent and nothing was changed.');
        return finish();
      }
      stage = 5;
      send('DATA');
      return;

    case 5:
      if (code !== 354) {
        console.log(`\nDATA refused: ${code} ${message_}`);
        console.log('The server will not take a body for this envelope.');
        return finish();
      }
      stage = 6;
      plain(stuffDots(message));
      plain('.');
      return;

    case 6:
      console.log('');
      if (code === 250) {
        console.log(`MESSAGE ACCEPTED: ${code} ${message_}`);
        console.log('The provider accepted the envelope and the body.');
        console.log('So a provider-side content rejection is ruled out.');
      } else {
        console.log(`MESSAGE REJECTED: ${code} ${message_}`);
        console.log('The provider refused the message itself. This is the stage');
        console.log('that decides whether the sender may reach this recipient,');
        console.log('so this is the answer that matters.');
      }
      console.log('');
      console.log('A message was delivered to the address above and nothing else changed.');
      return finish();

    default:
      return finish();
  }
}

function authFailed() {
  console.log(`\nauthentication failed: ${code} ${message_}`);
  console.log('The API key was rejected. Check it exists, is not revoked, and');
  console.log('belongs to this account.');
  finish();
}

function finish() {
  socket.end();
  setTimeout(() => process.exit(0), 200);
}

function attach(sock) {
  sock.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    drain();
  });

  sock.on('error', (error) => {
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

  sock.on('close', () => process.exit(0));
}

if (implicitTls) {
  socket = tls.connect({
    host,
    port: 465,
    servername: host,
    rejectUnauthorized: true,
  });
  attach(socket);
} else {
  socket = net.connect({ host, port: 587 });
  attach(socket);
}

setTimeout(() => {
  console.log('\ntimed out');
  socket.destroy();
  process.exit(1);
}, 60_000);