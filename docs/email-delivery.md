# Email delivery for sign-up

Sign-up needs to send one verification email per new retailer. On this Supabase
project that cannot happen today, and the reason is a project setting rather than
anything in the Vendra code.

## What is happening

Supabase's **built-in** email sender, used when no SMTP provider is configured:

- allows **2 messages per hour for the whole project**, and
- since September 2024 delivers **only to members of the Supabase organisation**.

So a sign-up from a real retailer fails with one of:

| Error code | What it means here |
|---|---|
| `over_email_send_rate_limit` | The project's two emails an hour are used up. |
| `email_address_invalid` | The address is not a Supabase team member, so the built-in sender will not deliver to it. |

Vendra reports the real reason rather than saying "try again", because no amount
of retrying helps. See `describeAuthError` in `web/src/lib/auth-actions.ts`.

## How to fix it

Pick one. Both are project settings, not code.

### Option A — connect an email service (the right fix)

Keeps the six-digit code meaningful, because the code proves the retailer can read
mail at that address.

1. Create an account with an email provider. Resend, Postmark, Brevo, Amazon SES
   and SendGrid all work. A free tier is enough for a pilot of a few dozen
   retailers.
2. Verify the sending domain with SPF, DKIM and DMARC.
3. In Supabase, open **Authentication → Emails → SMTP Settings**, turn on
   **Enable custom SMTP**, and enter the host, port, username, password and
   sender address.

   Direct link for this project:
   <https://supabase.com/dashboard/project/tdegxxqxrhbtmqcqfwls/auth/templates>

4. Set the email template so it shows `{{ .Token }}`, which is the six-digit code.
   A ready-made version is at `web/supabase/email-template.html` in this repo,
   adapted from the layout Homeplug uses.

5. Once SMTP is on, raise the limit under **Authentication → Rate Limits** →
   *Rate limit for sending emails*. Custom SMTP starts at 30 an hour, which is
   plenty for a pilot.

### Option B — turn off email confirmation (works today, weaker)

In **Authentication → Sign In / Providers → Email**, turn off **Confirm email**.

Vendra already handles this: `signUp` then returns a usable session, no code is
ever sent, and the sign-up form skips the code step and goes straight to
onboarding. Sign-up works immediately, with no email service at all.

**What is given up.** Anyone can claim any address. Nobody proves they can read
mail there. For an invite-only pilot with retailers you have spoken to, that is
often acceptable. For open public sign-up it is not: someone could register as
another shop, and password reset becomes unusable.

If you choose this, say so in the privacy notice rather than leaving it implied.
It changes what "your login and a display name" means in the data list.

### Option C — keep SMTP but raise only the rate limit

Not possible on the built-in sender. The two-per-hour figure is fixed, and the
`rate_limit_email_sent` setting only takes effect once custom SMTP or the Send
Email hook is enabled.

## Which is right for the pilot

Option A, if you can get a free SMTP account. It costs nothing at this scale and
it keeps the verification step meaningful, which is the whole reason the code
exists.

Option B, if you need sign-up working today and are recruiting retailers you have
already spoken to. It is honest as long as it is disclosed.

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
completing the flow and starting a session. That path is
`verifyCodeAction` → `supabase.auth.verifyOtp`, which is a single documented call,
but it is not exercised, and it is not claimed.
