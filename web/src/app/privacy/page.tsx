import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy and data',
  description:
    'What Vendra stores, who controls the memory account for each shop, how long records are kept and how to request export or deletion.',
};

/**
 * /privacy
 *
 * Written to match the implementation as built. Two things are stated plainly
 * rather than softened:
 *   1. the Walrus owner account is service-controlled in this pilot, so the
 *      retailer does not hold the key
 *   2. permanent erasure of Walrus Memory blobs has NOT been verified, so Vendra
 *      does not claim it
 *
 * This page is product copy for a pilot, not legal advice, and it says so.
 */
export default function PrivacyPage() {
  const sections = [
    {
      heading: 'What Vendra stores',
      body: [
        'Your login and a display name, so we can identify your account.',
        'Your shop: its name, an optional market or area, currency and timezone.',
        'Your team: who is in the shop, their role, and when access was granted or removed.',
        'Your supplier names, deal records and the notes you write about them. These include quoted and agreed prices, quantities, delivery notes, issues and resolutions.',
        'Files you attach to a deal, such as a photo of a message or a receipt. These are stored privately and are only reachable through a short-lived link that Vendra issues after checking that you are allowed to see that deal.',
        'Memories: short statements built from deal records you have confirmed. A memory holds a date, what happened and an internal reference back to the record it came from.',
        'Chat messages you send to Ask Vendra, kept so a conversation can continue.',
      ],
    },
    {
      heading: 'What Vendra deliberately does not store',
      body: [
        'Files are never given a permanent public link. There is no public page for any deal, receipt or note.',
        'Memories never contain a file, a link to a file, a supplier’s phone number, or a whole conversation.',
        'Vendra does not build a database of supplier ratings and never shows another shop what you paid.',
      ],
    },
    {
      heading: 'Who can see your records',
      body: [
        'You. Your shop’s deal history belongs to your shop.',
        'Staff you invite, and only within the role you give them. A manager can record deals, manage the team and change shop settings. Staff can view and record deals and use Ask Vendra.',
        'Suppliers have no access. There is no supplier account in Vendra. You can export or share a specific record yourself if you choose to.',
        'The Vendra service operator, for the purposes described under “Who controls your memory account” below.',
      ],
    },
    {
      heading: 'Who controls your memory account',
      body: [
        'For this pilot, Vendra’s service controls the Walrus Memory owner account for each shop. Each shop gets its own account reference and its own separate memory scope, so one shop cannot read another shop’s memories.',
        'However, the owner key is held by the service, not by you. This means an operator of the Vendra service could, in principle, reach the account that holds your shop’s memories. We are telling you this plainly rather than describing it as something you control.',
        'You do not need a wallet, and Vendra will never ask you for a recovery phrase or seed phrase.',
        'We plan to move to retailer-controlled accounts. Until that is done and verified, please do not store anything you would not want a service operator to be able to access.',
      ],
    },
    {
      heading: 'The model provider',
      body: [
        'When you ask a question, Vendra sends the question plus the specific deal records it retrieved to Google’s Gemini model to write the answer. It sends only the records needed to answer, never your whole history and never your files.',
        'Vendra then checks that every fact in the answer traces back to one of those records. If the records do not support an answer, Vendra says it could not find a saved record instead of guessing.',
      ],
    },
    {
      heading: 'What we can delete, and what we cannot yet confirm',
      body: [
        'Deal records, suppliers, chat messages and audit entries can be deleted from our database.',
        'Attached files can be removed from private storage. A copy in a backup may persist until the backup cycle completes.',
        'Memories written to Walrus Memory cannot yet be confirmed as permanently erased. The Walrus Memory SDK does not offer a deletion method, and the wallet-authenticated deletion flow has not been verified in this deployment. When you request deletion, your shop’s memory is switched off and the layer is reported as blocked rather than erased.',
        'We will not tell you something has been permanently erased unless we have checked it ourselves.',
      ],
    },
    {
      heading: 'Exporting and deleting',
      body: [
        'The shop owner can request a full export from Settings, under Privacy and data. The export is a file listing your shop, suppliers, deals, records, evidence metadata and memory history. Evidence files are not embedded; download them from their deals while you still have access.',
        'The shop owner can request deletion. You have to type the shop name to confirm. Deletion removes the shop’s records, files and messages, and switches off its memory. The request is tracked per data layer so any layer we cannot confirm is reported as blocked rather than counted as done.',
        'A manager can request an export but cannot delete the shop.',
      ],
    },
    {
      heading: 'Keeping records',
      body: [
        'Vendra keeps records while your shop uses it and needs the deal history. Closing a shop deletes its records under the process above.',
        'We keep the minimum security and audit metadata needed to investigate an access or payment dispute, without keeping deal content unnecessarily.',
        'We have not yet published a fixed retention period, because we would only publish a period the system can actually enforce.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can correct a deal. A correction creates a new record and keeps the original, so the history stays readable.',
        'You can export your data, revoke a staff member’s access, and request deletion.',
        'If you have a question or a concern about your data, raise it with the shop owner first if you are staff, or with Vendra if you are the owner.',
      ],
    },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--bg-surface)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
      >
        Skip to main content
      </a>

      <div className="relative z-10 min-h-dvh bg-[var(--bg-primary)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--surface-panel)]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-4 md:px-8 lg:px-12">
            <Link
              href="/"
              className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]"
            >
              Vendra
            </Link>
            <Link
              href="/app"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--text-on-accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-hover)]"
            >
              Try Vendra
            </Link>
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 md:py-16 lg:px-12">
          <div className="max-w-[70ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
              PRIVACY NOTICE
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)] md:text-5xl">
              What Vendra stores, and who can see it
            </h1>
            <p className="mt-5 font-body text-base leading-relaxed text-[var(--text-secondary)]">
              This notice describes the pilot build as it actually works, including its limits. It is product
              documentation, not legal advice, and it has not yet been through a qualified privacy review. If
              anything here does not match what you experience, tell us.
            </p>
          </div>

          <div className="mt-12 flex max-w-[70ch] flex-col gap-10">
            {sections.map((section) => (
              <section key={section.heading} className="border-t border-[var(--border-default)] pt-6">
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-2xl">
                  {section.heading}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {section.body.map((paragraph) => (
                    <li
                      key={paragraph}
                      className="flex items-start gap-3 font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                      {paragraph}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="mt-12 max-w-[70ch] border-t border-[var(--border-default)] pt-6 font-body text-xs leading-relaxed text-[var(--text-muted)]">
            Vendra is designed for independent grocery and provisions retailers and is starting in Delta State,
            Nigeria. Before onboarding non-test users, Vendra intends to complete a review against the Nigeria
            Data Protection Act 2023 and relevant Nigeria Data Protection Commission guidance.
          </p>
        </main>
      </div>
    </>
  );
}