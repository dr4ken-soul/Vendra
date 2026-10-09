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

### The domain is not optional for production, but it is not the current blocker

An earlier version of this file said the `resend.dev` domain was the reason
sign-up fails, on the strength of a Resend documentation page. **That was wrong,
and it was measured wrong.** `scripts/probe-resend-smtp.mjs` speaks SMTP to Resend
with the same credentials and the same addresses, and Resend answers:

```
< 235 Authentication successful
> MAIL FROM:<onboarding@resend.dev>
< 250 Accepted
> RCPT TO:<vendra-probe@example.test>
< 250 Accepted
```

The sender and the recipient are both accepted. The documented `resend.dev`
restriction did not occur.

Two things follow. First, no domain is needed to get sign-up working. Second,
the failure is somewhere Supabase is not disclosing, because Supabase returns a
generic `Error sending confirmation email` with no code and no detail.

A verified domain is still worth having before inviting anyone outside the team:
it is the only way the recipient sees a real sender address, and it is what SPF,
DKIM and DMARC authenticate against. But it is a polish item, not the blocker.

## What is actually known about the failure

| | |
|---|---|
| SMTP is active | Supabase no longer returns `email_address_invalid` |
| The send is rejected | `Error sending confirmation email`, no code |
| Resend accepts these credentials | probe: `235 Authentication successful` |
| Resend accepts this sender to a foreign recipient | probe: `250` on both `MAIL FROM` and `RCPT TO` |

What has **not** been established is why. The gap is that Supabase does not
surface the provider's error. The authoritative source is **Authentication → Logs**
in the Supabase dashboard, which records the SMTP exchange.

## How to check it in one command

`web/scripts/check-signup-send.mjs` attempts a real sign-up and prints the exact
Auth error, then deletes the account it created. Run it after every change to the
SMTP settings:

```bash
cd web
node scripts/check-signup-send.mjs
```

It separates the cases that look identical from inside the application: the
built-in sender refusing an address, and SMTP being active with the send failing.

## The provider probe

`web/scripts/probe-resend-smtp.mjs` reports what Resend actually says, without
sending anything. The key is read from the environment and never printed.

```bash
$env:RESEND_API_KEY = "re_..."
node scripts/probe-resend-smtp.mjs
```

Three bugs in that script are worth recording, because each produced a confident
wrong answer. It sent `EHLO` before reading the greeting and was told `421 You
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

This file went back and forth on the `resend.dev` restriction before landing in the
wrong place twice. It claimed the address delivered only to the account owner,
then claimed it delivered to anyone, then claimed the restriction was blocking
sign-up. Only the first was supported, and it is not supported either: measured
directly, Resend accepts the address for any recipient.

What actually happened each time was matching a symptom to a documentation page
without checking whether the page described the observed behaviour. Twice the
apparent contradiction between the page and the symptom was resolved by
re-reading the page rather than by testing.

The measurements themselves were also untrustworthy for three runs, for reasons
that had nothing to do with Resend: the probe spoke before the server greeted it,
then lost the capabilities because it read only the last line of a multi-line
reply. A wrong answer from a tool I wrote is not evidence, however confident its
output format.

The standing rule for this file: **a plausible match is not a finding.** Say what
was measured, say what was assumed, and do not let the second become the first.

