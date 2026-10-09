# Email delivery for sign-up

Sign-up sends one verification email per new retailer. **This now works.** Supabase
is configured to send through Mailjet, which validates a single sender address by
email rather than requiring a domain, so nothing had to be bought.

This file spent a long time being wrong about why sign-up failed. The history is
kept below because it is the reason the current setup is believed.

## Current configuration

| Field | Value |
|---|---|
| Provider | Mailjet, free plan — 200 emails a day |
| Host | `in-v3.mailjet.com` |
| Port | `587` (STARTTLS) |
| Username | Mailjet API key |
| Password | Mailjet secret key |
| Sender email | `vendraagent@gmail.com` |
| Sender name | `Vendra` |

The sender is a single validated address, not a domain. Mailjet confirmed it
`Active`, and Supabase Auth then accepted a sign-up for an address belonging to
nobody in this project:

```
address  : vendra-retailer-63381@vnd-retailer-probe.com
signUp ACCEPTED by Supabase Auth.
```

That is the check that matters. Supabase Auth returns an error when its mailer
fails, so acceptance means the provider took the message. This is what Resend
refused to do.

**Still to be verified:** a real sign-up in the browser, with a deliverable address
and a correct code, completing to a session. Acceptance is not delivery. No test
run proves that, because a test address has no mailbox to receive into.

## Why Homeplug does not have this problem

It has custom SMTP configured. That is the explanation, and it is worth stating
plainly because an earlier version of this file did not.

An earlier draft claimed Homeplug had the same defect and was "just waiting to be
triggered". That was an inference drawn from the absence of SMTP settings in its
environment files. It was wrong, and wrong in a way worth recording: SMTP settings
live in the Supabase dashboard, not in the repository, so their absence from
`.env` and `.env.local` is not evidence of anything. Homeplug demonstrably delivers
to addresses that are not the developer's, which is exactly what a configured SMTP
provider enables and the built-in sender forbids.

## The provider that was tried first, and why it was abandoned

Resend was configured first and does not work here, for one reason: it requires a
verified domain.

**The key goes in the Supabase dashboard. It is never added to Vendra's code, and
nothing in `.env.local` changes.** Supabase's Auth server sends the mail itself.
That is unchanged with Mailjet.

### The domain requirement, measured rather than assumed

`scripts/probe-smtp.mjs --port 587 --data` gets a complete message as far as
Resend, and Resend refuses it:

```
> DATA
< 354 End data with <CR><LF>.<CR><LF>
< 550 You can only send testing emails to your own email address
  (psychoancestor092@gmail.com). To send emails to other recipients, please
  verify a domain at resend.com/domains, and change the 'from' address to an
  email using this domain.
```

`onboarding@resend.dev` is a test sender. It delivers to the account owner's own
inbox and nowhere else. **A verified sending domain is required.** For a project
that cannot buy one, Resend is not usable, and Mailjet replaced it.

That is exactly what an earlier version of this file said, and it was right. The
version after it said the opposite, on the evidence of a probe that stopped at
`RCPT TO` and read `250` as permission to send. **The probe was not wrong; the
conclusion drawn from it was.** Resend answers `RCPT TO` with `250` and decides
the recipient question at `DATA`. A probe that never submits a body cannot see the
restriction no matter how carefully it is written.

So this file asserted the correct answer, denied it, and asserted it again. The
denial was the error, and it came from trusting a partial measurement over a
complete one.

## What was established about Resend

| | |
|---|---|
| SMTP is active | Supabase no longer returns `email_address_invalid` |
| Credentials work | probe: `235 Authentication successful` |
| Port is not the cause | the full dialogue completes on both 465 and 587 |
| The domain is not the cause | three different recipient domains give the identical error |
| **Sender is the cause** | **probe: `550` at `DATA`, "only send testing emails to your own email address"** |

Supabase surfaces none of this. It returns a generic `Error sending confirmation
email` with no code and no detail, which is why the provider had to be spoken to
directly. The Resend dashboard shows nothing either, because a message refused at
`DATA` is never queued and so never appears under Emails.

## How to check it in one command

`web/scripts/check-signup-send.mjs` attempts a real sign-up and prints the exact
Auth result, then deletes the account it created. Run it after any change to the
SMTP settings:

```bash
cd web
node scripts/check-signup-send.mjs
node scripts/check-signup-send.mjs some.retailer@example.com
```

Three failures have looked identical from inside the application, and this
separates them by the code Supabase returns:

| Code | Meaning |
|---|---|
| `email_address_invalid` | the built-in sender, team addresses only |
| `over_email_send_rate_limit` | the project's hourly cap |
| `Error sending confirmation email` | custom SMTP active, the provider refused |

Acceptance is a real result, because Supabase reports send failures rather than
swallowing them. Acceptance is not delivery, and a test address with no mailbox
cannot confirm delivery, because a bounce proves nothing either way.

## The provider probe

`web/scripts/probe-smtp.mjs` reports what the provider actually says. The password is
read from the environment and never printed.

```bash
$env:RESEND_API_KEY = "<the provider's SMTP password>"
node scripts/probe-smtp.mjs --host in-v3.mailjet.com --user "<api key>" \
      --port 587 --from vendraagent@gmail.com --to someone@example.com --data
```

The variable name is historical. `--host` and `--user` make the probe work against
any provider, so a candidate can be measured before it is adopted:

```bash
$env:RESEND_API_KEY = "<that provider's SMTP key or app password>"
node scripts/probe-smtp.mjs --host smtp.example.com --user you \
                  --port 587 --from you@example.com --to probe@example.test --data
```

`--data` is not optional in practice. Without it the probe stops at `RCPT TO`,
and `RCPT TO` is exactly the stage where the `resend.dev` restriction is still
invisible. That is the mistake this file made twice.

Six bugs in that script produced six confident wrong answers, and they are worth
recording together because the pattern is more useful than any one of them:

| # | What it did | What the server said |
|---|---|---|
| 1 | sent `EHLO` before the greeting | `421 You talk too soon` |
| 2 | read only the last line of `EHLO` for `AUTH` | had advertised `AUTH PLAIN LOGIN` |
| 3 | `From` header did not match the envelope sender | `550 Invalid 'from' field` |
| 4 | waited for a re-greeting after `STARTTLS` | sent none; RFC 3207 allows either |
| 5 | doubled every period, not leading ones | `550 Invalid 'from' field` again |
| 6 | — | — |

Bugs 3 and 5 both produced a `550` naming the From field, and neither was about
the From field. Both were mine, and both would have been read as facts about the
account if taken at face value.

Every one of them came from encoding a protocol rule from memory instead of
reading the transcript that was showing it break. The standing rule for this
file: **a partial measurement is not a weaker finding, it is a different
measurement.** Stopping at `RCPT TO` did not weaken the domain conclusion, it
replaced it.
talk too soon`; then it searched only the final line of the multi-line `EHLO`
reply for `AUTH` and reported that Resend offered no mechanism, when it had
advertised `AUTH PLAIN LOGIN` three lines earlier. Both were checked against the
literal transcript before the final run was trusted.

The lesson is the one already recorded below: a plausible match between a
symptom and a web page is not a finding.


### 2. Enter them in Supabase

<https://supabase.com/dashboard/project/tdegxxqxrhbtmqcqfwls/auth/smtp>

This is the **SMTP Settings** tab next to **Templates** on the page in the
screenshot. Turn on *Enable custom SMTP* and fill in the five fields above.

This is the step the screenshot is blocked on. The banner says *"Set up custom SMTP
to edit templates"*, which is literal: the template fields stay read-only until SMTP
is configured. That is why this cannot be skipped or reordered.

### 3. Now the template becomes editable

Once SMTP saves, the **Templates** tab unlocks. Open **Confirm sign up** and paste
the body from `web/supabase/email-template.html`. It shows `{{ .Token }}`, which is
the six-digit code.

Supabase only permits editing templates once SMTP is on, which is why the ready-made
template is committed to the repository rather than pasted into the dashboard.

### 4. Raise the limit

Saving custom SMTP sets a default of **30 messages per hour**, which is ample for a
pilot. To change it:

<https://supabase.com/dashboard/project/tdegxxqxrhbtmqcqfwls/auth/rate-limits>

Set *Rate limit for sending emails*. Thirty an hour is more than a handful of
retailers will ever need.

## What about turning email confirmation off instead?

I mentioned this earlier as a shortcut. On reading Supabase's own guidance it is
worse than I made it sound, so here it is accurately:

Supabase's documentation explicitly says **"Do not disable email confirmations under
pressure"**, and describes what happens if you do:

> bots and attackers sign up users to your application using lists of known email
> addresses... At that point they may target specific or broad ranges of users by
> creating an account in their name.

With confirmation off, anyone can register as an existing retailer, and password
reset cannot work at all, because there is no way to prove the address belongs to
whoever is asking.

Vendra already handles this mode correctly — `signUp` returns a session, the form
skips the code step and goes to onboarding — so it would work today with one click.
But it weakens the product for real users, and it should be a decision made
knowingly rather than as a workaround. For an invite-only pilot with retailers you
have already spoken to, it is defensible. For anything open to the public, it is not.

If you do choose it, say so in the privacy notice. It changes what "your login and a
display name" means, because nobody has proved the address is theirs.

## Cost

Supabase: free tier, no change.

Resend: free tier allows 3,000 emails a month and 100 a day. A pilot of a few dozen
retailers will not come close. Paid plans start when you outgrow that.

## When a domain cannot be bought

Resend requires one, so the constraint was initially read as unavoidable. It is a
Resend requirement, not an SMTP one. This section records what was actually
measured about the alternatives.

### Mailjet — no domain required, and in use

**This is what is configured and working.** Mailjet validates a single sender
address by emailing an activation link, which needs no DNS at all. From Mailjet's
own documentation:

> When you add a specific sender email address, an automatic activation email will
> be sent to it. To complete the validation, you need to have access to the
> respective sender's inbox, as well as your Mailjet account's username and
> password. Simply click on the activation link within the email.

Validating a whole domain is offered as an *alternative*, by DNS TXT record or by
hosting a text file. It is not the only route.

Measured against the live server, `scripts/probe-smtp-capabilities.mjs`:

```
target  in-v3.mailjet.com:587
< 220 in.mailjet.com ESMTP Mailjet
< 250-STARTTLS
< 250-AUTH PLAIN LOGIN DIGEST-MD5 CRAM-MD5
> STARTTLS
< 220 2.0.0 Ready to start TLS
  [TLS established]

    AUTH PLAIN         : yes
    max message size   : 15,728,640
```

`AUTH PLAIN` is what Supabase's GoTrue authenticates with, so its presence is what
matters. Both host and ports come from Mailjet's SMTP documentation: host
`in-v3.mailjet.com`, port 587 for STARTTLS or 465 for implicit TLS. Credentials are
at <https://app.mailjet.com/account/relay> — username is the API key, password is
the secret key.

Free plan: 200 emails a day, 6,000 a month, and the SMTP relay is listed as
included. That is far beyond a pilot.

**The cost is honest and worth stating:** the sender is a personal address, so
retailers see `Vendra <your-address@gmail.com>`. `gmail.com`'s SPF does not
authorise Mailjet, so there is no SPF alignment on the From domain. Mailjet signs
with its own DKIM, which helps, but delivery is weaker than a real domain and some
messages may land in spam. For a handful of retailers you already know, that is a
reasonable trade for not needing a domain. It is not a permanent arrangement.

### Brevo — ruled out

Reachable and technically fine. Measured: `smtp-relay.brevo.com:587` offers
STARTTLS and `AUTH PLAIN`.

Ruled out on policy, not on capability. Brevo's help centre states that sending
from a free address will be rejected:

> Sending from a free email address (@gmail, @yahoo, etc.) will cause your emails
> to be rejected.

and directs users to a professional address on their own domain. So Brevo has the
same requirement as Resend. Recorded so it is not re-checked.

*Note on sourcing:* the above is Brevo help-centre text retrieved from a search of
`help.brevo.com`. The article pages themselves returned 404 and could not be opened
directly, so the wording is quoted from the centre's own search results rather than
the full article. The claim is strong and consistent across three of their
articles, but it is not a full-text citation.

### The rest

**Supabase's built-in sender.** Free, and it sends two emails an hour, but only to
addresses belonging to the Supabase organisation's team. Useless for retailers.

**A domain that costs nothing.** Free and low-cost registrations exist. Their
catch is that some registrars require a card for verification even at a zero
price, so "free" does not always mean "no payment details". Worth revisiting once
a real pilot is running.

**Turning email confirmation off.** Supabase can be set to skip confirmation
entirely. See the section above for the security trade-off. It is the weakest
option and is no longer needed.

**Send the code some other way.** Only relevant for a pilot small enough that the
founder can hand it over. It does not scale and should not be mistaken for a
solution.

### What was verified, and what was not

Verified by measurement:

- Mailjet accepts STARTTLS on 587 and offers `AUTH PLAIN` inside TLS.
- Brevo accepts STARTTLS on 587 and offers `AUTH PLAIN` inside TLS.
- Mailjet's documentation describes single-address validation with no DNS step.
- Brevo's help centre says free addresses are rejected.

**Not verified:** that Mailjet actually accepts a `DATA` submission for this
account. That needs Mailjet credentials, which this project does not have and must
not be given to it. It is one command once the account exists:

```bash
$env:RESEND_API_KEY = "<mailjet secret key>"
node scripts/probe-smtp.mjs --host in-v3.mailjet.com --user "<mailjet api key>" \
      --port 587 --from "<your address>" --to "<someone else's address>" --data
```

If that reports `MESSAGE ACCEPTED`, Supabase is configured and sign-up works for
everyone.

### What was verified, and what was not

Measured directly:

- Resend refuses `DATA` from `onboarding@resend.dev` to any recipient other than
  the account owner's address. That is the blocker, and it is not a bug.
- Sign-up **succeeds** when the recipient is the account owner's own address. Run:
  `node scripts/check-signup-send.mjs <your-own-address>`.

Not measured, and therefore not claimed:

- that Mailjet accepts an actual `DATA` submission for a real account. See above;
  it needs credentials this project does not hold.

## What is verified and what is not

Verified against the running application, in a browser:

- sign-up reaches the code step and renders six labelled digit boxes;
- a pasted six-digit code spreads across all six boxes;
- the code auto-submits once complete, so there is no button to hunt for;
- a wrong code produces exactly one message, carrying the server's real reason;
- the resend control counts down from 60 seconds;
- sign-in with an unconfirmed address reaches the same code step, which is how the
  flow was exercised without a deliverable email.

Not verified, because it cannot be until email actually flows: a **correct** code
completing the flow and starting a session. That path is `verifyCodeAction` →
`supabase.auth.verifyOtp`, a single documented call, but it is not exercised and it
is not claimed.

`web/scripts/check-signup-send.mjs` is the tool that gets this far. Run it after
changing the SMTP settings; it reports the exact error and deletes the account it
created. It distinguishes the built-in sender refusing an address from SMTP being
active but the send failing, which are different problems with the same symptom
from inside the app.

## A correction worth recording

This file asserted the `resend.dev` restriction, then denied it, then re-asserted
it. The final position is the original one, and the denial was the mistake.

The denial rested on a probe that had reached `RCPT TO` and received `250`. That
`250` is real and it is not in dispute. What it means is narrower than what was
claimed from it: it says the envelope was accepted, not that the message will be
sent. Resend defers the recipient check to `DATA`, so the probe was stopped one
stage short of the only stage that answers the question. A correct measurement was
turned into a wrong conclusion by reading past what it covered.

The cost of that was concrete. While this file said no domain was needed, the
project sat with SMTP configured to a test sender that cannot reach any retailer.
The diagnosis had been available from the first run; it was withheld because a
partial result was preferred to the inconvenient one.

Two rules follow, and they are narrower than the general advice they replace:

**A partial measurement is not a weaker finding, it is a different measurement.**
Know which stage a probe stopped at before quoting what it proves.

**Do not override an inconvenient measurement with a convenient one.** The
original claim was correct and was reversed without new evidence against it — only
with evidence that had not yet been gathered. That asymmetry, not the probe bug,
is what cost the most.

