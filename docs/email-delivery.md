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

### The domain is not optional

This was found the hard way. With the sender set to `onboarding@resend.dev`,
sign-up fails at the send step with `Error sending confirmation email`, and Resend
rejects the message with:

> You can only send testing emails to your own email address
> (your-email-address@domain.com). To send emails to other recipients, please
> verify a domain at resend.com/domains, and change the `from` address to an email
> using this domain.

`onboarding@resend.dev` is a testing address. It delivers to the Resend account
owner's own inbox and nowhere else. It is not a usable production sender, and no
setting changes that.

The saving grace is that reaching this error proves the SMTP configuration itself
is working. Supabase stops returning `email_address_invalid` — the address is now
accepted and a message is handed to the provider. Only the sender is wrong.

The values are fixed:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` for implicit SSL, or `587` for STARTTLS |
| Username | `resend` |
| Password | your Resend API key |
| From address | **must be on your verified domain**, e.g. `no-reply@yourdomain.com` |

## Why the sender address cannot simply be renamed

There is no way to make the recipient see `hello@vendra.com` without owning
`vendra.com`. Sending infrastructure authenticates the From address with SPF,
DKIM and DMARC, all of which are DNS records on the sending domain. A domain you
do not control cannot be authenticated for you, which is precisely what stops
anyone from sending mail as your business.

So there are exactly two options for the sender:

| | Sender shows as | Works? |
|---|---|---|
| No domain | `onboarding@resend.dev` | **No.** Only to your own inbox. |
| Owned domain | `Vendra <no-reply@yourdomain.com>` | Yes. |

The **display name** is separate from the address and is already set to `Vendra`
in the sender name field, so many inboxes will render the sender as simply
"Vendra" either way. That is a mitigation, not a fix: the address is still visible
in the details pane, and some clients show only the address.

A domain costs a few dollars a year. Cloudflare Registrar sells at cost,
Namecheap and Porkbun are similar. Once added to Resend with the DNS records it
asks for, the sender can be `no-reply@yourdomain.com` and mail to any retailer
works.

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

This file first claimed `onboarding@resend.dev` "delivers to any recipient". That
was wrong, and it was wrong twice over: the original claim had been right, and it
was overturned by a documentation page that turned out not to be about the
restriction. The evidence for the reversal was weaker than the claim it replaced.

The correct rule, from Resend's own error documentation, is that the `resend.dev`
domain sends only to the account owner's own address. Verified by getting the 403.

