# Email delivery for sign-up

Sign-up needs to send one verification email per new retailer. On this Supabase
project that cannot happen today, and the reason is a project setting rather than
anything in the Vendra code.

## What is happening

Supabase's **built-in** email sender, used when no SMTP provider is configured, has
two restrictions. From the Supabase documentation:

> Unless you configure a custom SMTP server for your project, Supabase Auth will
> refuse to deliver messages to addresses that are not part of the project's team.

> To maintain the health and reputation of the default SMTP sending service, the
> number of messages your project can send is limited... Currently this value is set
> to 2 messages per hour.

So it sends **2 emails an hour, project-wide, and only to addresses belonging to
your Supabase organisation's team members**. A retailer signing up with their own
gmail address gets nothing, and the failure looks like one of:

| Error code | What it means here |
|---|---|
| `email_address_invalid` | The address is not a team member, so the built-in sender will not deliver to it. |
| `over_email_send_rate_limit` | The project's two emails an hour are used up. |

Vendra reports the real reason rather than saying "try again", because no amount of
retrying helps. See `describeAuthError` in `web/lib/auth-actions.ts`.

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

What is actually established about Vendra is narrower and still stands: **this
project** fails with `email_address_invalid` for addresses outside its Supabase
organisation, verified directly against the running application. Nothing about
another project follows from that.

## The fix: connect an email service

Any SMTP provider works. Resend is the quickest to set up and has a free tier.

**The key goes in the Supabase dashboard. It is never added to Vendra's code, and
nothing in `.env.local` changes.** Supabase's Auth server sends the mail itself.

### 1. Get SMTP credentials from Resend

<https://resend.com/signup>

You need two things:

- an **API key** — <https://resend.com/api-keys> → *Create API Key*
- a **verified sending domain** — <https://resend.com/domains> → *Add Domain*

### The domain is the blocker, and it was measured at DATA, not at RCPT

The cause is confirmed. `scripts/probe-smtp.mjs --port 587 --data` gets a
complete message as far as the provider, and Resend refuses it:

```
> DATA
< 354 End data with <CR><LF>.<CR><LF>
< 550 You can only send testing emails to your own email address
  (psychoancestor092@gmail.com). To send emails to other recipients, please
  verify a domain at resend.com/domains, and change the 'from' address to an
  email using this domain.
```

`onboarding@resend.dev` is a test sender. It delivers to the account owner's own
inbox and nowhere else. **A verified sending domain is required, and it is the
only thing standing between this project and working sign-up.**

That is exactly what an earlier version of this file said, and it was right. The
version after it said the opposite, on the evidence of a probe that stopped at
`RCPT TO` and read `250` as permission to send. **The probe was not wrong; the
conclusion drawn from it was.** Resend answers `RCPT TO` with `250` and decides
the recipient question at `DATA`. A probe that never submits a body cannot see the
restriction no matter how carefully it is written.

So this file has now asserted the correct answer, denied it, and asserted it again.
The denial was the error, and it came from trusting a partial measurement over a
complete one.

## What is established

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

## The fix, in order

1. **Verify a sending domain** — <https://resend.com/domains> → *Add Domain*. Add
   the DNS records it asks for. This is the blocker and it cannot be worked around
   in code.
2. **Set Supabase's sender** — Authentication → Emails → SMTP Settings → *Sender
   email* → `no-reply@<your-verified-domain>` → Save.
3. **Confirm** with `node scripts/check-signup-send.mjs`, which signs up, prints
   the exact Auth error, and deletes the account it created.

Until step 1 is done, sign-up cannot work for any retailer. That is a real
blocker, not a configuration detail.

## How to check it in one command

`web/scripts/check-signup-send.mjs` attempts a real sign-up and prints the exact
Auth error, then deletes the account it created. Run it after every change to the
SMTP settings:

```bash
cd web
node scripts/check-signup-send.mjs
```

## The provider probe

`web/scripts/probe-smtp.mjs` reports what the provider actually says. The password is
read from the environment and never printed.

```bash
$env:RESEND_API_KEY = "re_..."
node scripts/probe-smtp.mjs --port 587 --data
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

The constraint is real and it is not always solvable with money, so this section
records the ways out that do not involve paying for one.

**Supabase's built-in sender.** Free, and it sends two emails an hour, but only to
addresses belonging to the Supabase organisation's team. Useless for retailers.

**Providers that will accept a single verified address rather than a domain.**
This is the option worth checking, because it removes the domain requirement
entirely. Whether a given provider allows it changes, and it is not something to
guess at — measure it with `scripts/probe-smtp.mjs --data` before configuring
Supabase, and read the provider's own sender-verification documentation rather
than a comparison article.

**A domain that costs nothing.** Free and low-cost registrations exist. Their
catch is that some registrars require a card for verification even at a zero
price, so "free" does not always mean "no payment details".

**Turning email confirmation off.** Supabase can be set to skip confirmation
entirely. See the section above for the security trade-off. It is the only option
here that requires nothing from anyone, and it is the weakest.

**Send the code some other way.** Only relevant for a pilot small enough that the
founder can hand it over. It does not scale past a handful of people and should
not be mistaken for a solution.

### What was verified, and what was not

Measured directly:

- Resend refuses `DATA` from `onboarding@resend.dev` to any recipient other than
  the account owner's address. That is the blocker, and it is not a bug.
- Sign-up **succeeds** when the recipient is the account owner's own address. Run:
  `node scripts/check-signup-send.mjs <your-own-address>`.

Not measured, and therefore not claimed:

- whether Brevo, Mailjet or any other free provider accepts a single verified
  address instead of a domain. Their pricing pages were read; their sender
  verification rules were not confirmed, and one Brevo page explicitly
  contradicted the marketing page on whether a domain is needed. `probe-smtp.mjs`
  exists so this can be settled by measurement rather than by argument.

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

