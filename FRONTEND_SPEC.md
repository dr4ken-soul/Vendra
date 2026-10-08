# Vendra Frontend Specification

**Status:** Planning specification only. All seven design gates are approved. The landing-page video has now been inspected and its real metadata is recorded in section 1.5a.  
**Video status:** The approved export was located in `video/` and inspected. Verified metadata, the production web copy and the poster path are recorded below. One deviation from the brief is recorded honestly in section 1.5a.  
**Implementation rule:** Do not begin implementation until the user approves this specification.  
**Scope:** Complete responsive web frontend specification for the public landing page and authenticated app screens. The landing page follows the seven approved design gates. App screens reuse its tokens and type system but use a calm, solid operational shell without the marketing video. The app screen layouts and states are specified below.  
**Reference note:** Recipe names and the A2 navigation pattern refer to the user-supplied frontend skill and composition-guide attachments. They are guidance inputs, not runtime files; this spec restates the approved implementation details needed by the Vendra build.

---

## 0. Project identity and approved direction

- **Product:** Vendra
- **One-line value:** Remember what each supplier quoted, agreed, delivered and resolved, with the evidence ready before the next purchase.
- **Aesthetic:** Swiss rational, operational bento grid
- **Identity fingerprint:** top-left lead, bottom-right support / Swiss rational / monochrome plus one pop / one fixed ambient video across the full page / editorial stagger / subtle precision
- **Design dials:** `DESIGN_VARIANCE 5`, `MOTION_INTENSITY 2`, `VISUAL_DENSITY 7`
- **Navigation:** Gate 2, A2 scroll-morph pill
- **Background:** Gate 3, cinematic ambient loop, subtype 1c. Staggered viewport reveals replay when sections re-enter view.
- **Fonts:** Barlow and Azeret Mono
- **Palette:** cool light-neutral surfaces, charcoal text, restrained vermilion accent, semantic status colours
- **Hero:** asymmetric, product-led
- **Page order:** nav, hero, problem, deal timeline, recall demo with evidence, outcomes ledger, memory/access, FAQ, final CTA, footer
- **FAQ:** split editorial layout. First answer is open on arrival. Multiple independent answers may stay open.
- **Brand marks:** text wordmark “Vendra” only. Do not add a logo, icon mark, monogram, AI-generated symbol or favicon artwork.
- **Proof:** no invented testimonials, customer counts, savings, performance metrics or supplier ratings.

## 1. Global design system

### 1.1 Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Azeret+Mono:wght@400;500;600&display=swap');
```

- `font-display`: `Barlow`, sans-serif, weight 600
- `font-body`: `Barlow`, sans-serif, weights 400 and 500
- `font-mono`: `Azeret Mono`, monospace, weights 400, 500 and 600
- Use Barlow for readable headings and body. Use Azeret Mono only for short labels, deal metadata, timestamps and status text. Do not use a third font or JetBrains Mono.
- Tailwind mapping: `font-display: ['Barlow', 'sans-serif']`, `font-body: ['Barlow', 'sans-serif']`, `font-mono: ['Azeret Mono', 'monospace']`.
- Production should self-host the selected font files through `next/font` with `font-display: swap`; the Google Fonts URL above records the approved pairing and weights.

### 1.2 Colour tokens

```css
:root {
  color-scheme: light;

  --bg-primary: #F4F6F4;
  --bg-secondary: #ECEFED;
  --bg-surface: #FBFCFB;
  --bg-elevated: #FDFEFD;
  --surface-panel: rgba(251, 252, 251, 0.94);
  --surface-glass: rgba(251, 252, 251, 0.82);
  --surface-muted: rgba(251, 252, 251, 0.76);
  --surface-wash: rgba(251, 252, 251, 0.62);
  --surface-subtle: rgba(251, 252, 251, 0.48);

  --text-primary: #242A27;
  --text-secondary: #59635E;
  --text-muted: #69726D;
  --text-on-accent: #FFF8F6;

  --accent: #B9402E;
  --accent-hover: #A83829;
  --accent-soft: rgba(185, 64, 46, 0.10);
  --accent-border: rgba(185, 64, 46, 0.28);

  --success: #2F7654;
  --success-soft: rgba(47, 118, 84, 0.10);
  --warning: #86570F;
  --warning-soft: rgba(134, 87, 15, 0.11);
  --error: #B5413F;
  --error-soft: rgba(181, 65, 63, 0.10);
  --info: #456C7B;
  --info-soft: rgba(69, 108, 123, 0.10);

  --border-subtle: rgba(36, 42, 39, 0.07);
  --border-default: rgba(36, 42, 39, 0.13);
  --border-strong: rgba(36, 42, 39, 0.22);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --shadow-sm: 0 1px 3px rgba(32, 42, 36, 0.05);
  --shadow-md: 0 3px 8px rgba(32, 42, 36, 0.07);
  --shadow-lg: 0 8px 14px rgba(32, 42, 36, 0.08);

  --duration-fast: 120ms;
  --duration-normal: 220ms;
  --duration-slow: 420ms;
  --ease-precision: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Use the darker vermilion only for primary actions, focused labels and small status accents. Do not tint every card or heading red. Keep surfaces cool and light-neutral. The muted text and accent foreground/background pairings meet the specified contrast target on the light surfaces. Use semantic colours only for actual statuses.

### 1.3 Global layout and page background

- Page background: `bg-[var(--bg-primary)]`.
- Main content wrapper: `relative z-10`.
- Maximum content width: `max-w-[1280px] mx-auto`.
- Main side gutters: `px-5 md:px-8 lg:px-12`.
- Section rhythm varies: hero and final CTA are spacious; timeline and evidence sections are denser; FAQ is editorial and calm.
- The video remains fixed behind the entire page, including the footer. It is mounted once at the app root, not once per section.
- Content sections remain above the video. Use transparent section backgrounds where readable. Use translucent cool-neutral panels and local text-safe surfaces for dense content.

Global page classes:

```text
html: scroll-smooth [scrollbar-width:none]
body: min-h-screen overflow-x-hidden bg-[var(--bg-primary)] font-body text-[var(--text-primary)] antialiased
::-webkit-scrollbar: hidden
main#main-content: relative z-10 isolate
section: relative z-10 scroll-mt-24
:focus-visible: outline 2px solid var(--accent); outline-offset 3px
```

The scrollbar is hidden while keyboard, screen-reader and touch scrolling remain available. The global focus-visible rule applies to all controls and links unless a local style provides an equally clear indicator.

**Skip link:** the first focusable element in the document is an anchor with `href="#main-content"` and the exact classes `sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--bg-surface)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]`. Its visible text is `Skip to main content`.

**Icon rule:** use inline SVG only for functional icons such as menu, chevron and video pause/play. Do not use emoji, raster icons or an unapproved icon library. Icons are decorative when the control already has an accessible text label; icon-only controls require an `aria-label`.

### 1.4 Global z-index map

```text
z-0:     single fixed ambient video, full viewport, pointer-events-none
z-[1]:   full-page light contrast wash above the video
z-[3]:   fine grain overlay, pointer-events-none
z-10:    page structure, section content and all ordinary text
z-20:    product panels and evidence cards inside a section
z-30:    tooltips and local menus
z-50:    scroll-morph navigation shell and its controls
z-[52]: navigation drawer scrim, above the navigation shell
z-[55]: navigation drawer panel, above the scrim
z-[60]: authentication dialog and blocking confirmations
```

No section is allowed to place content below the fixed video. No decorative layer may intercept pointer events.

### 1.5 Background video asset brief

**ASSET BRIEF**

- **Type:** one full-page looping ambient video, used once behind all landing-page sections
- **Generation:** one Google Flow generation using all five approved reference images together in the previously supplied unified prompt. The user reports the export is approved; **the export has now been located in `video/` and inspected — see section 1.5a.**
- **Description:** a single connected supplier-deal story in a bright independent produce shop. The same two light-skinned Latina women, clothing, positions and shop continue through agreement, carton handoff, delivery inspection and a final phone-based recall moment. The scene keeps the plain order slip and carton with vermilion tape consistent. The approved iPhone 16 Pro Max back may appear in the final beat, with its logo area obscured by a hand. No visible brand marks or readable text.
- **Style:** quiet documentary, soft natural daylight, realistic skin and movement, restrained camera, light neutral grade with the vermilion tape as the only strong colour accent
- **Motion:** natural gestures, gentle camera movement only. No cuts that feel like separate adverts. One generated video asset, not four individual generated clips.
- **Composition:** wide 16:9. Keep the people mainly on the right side and preserve clean negative space on the left where possible.
- **Generation duration:** one 8-second generation was requested. Verify actual exported duration from the uploaded file before implementation.
- **Delivery target:** 1080p minimum, MP4 H.264, silent, ideally under 10 MB. Compress or stream through a CDN if the approved export exceeds the web budget.
  **Actual result:** 720p (see the deviation note in 1.5a), MP4 H.264 Main, silent, 1.13 MB. Under budget; below the resolution target, for the reason recorded there.
- **Source location:** `video/Creating_supplier_deal_video_sto._20261006235511.mp4`
- **Published copy:** `web/public/video/vendra-ambient-loop.mp4` — an optimised silent re-encode of the approved export. Poster at `web/public/video/vendra-ambient-loop-poster.jpg`.
- **Loop behaviour:** use native looping if the export has a clean loop point. If the join is visible, use the crossfade method from `COMPOSITION_RECIPES.md`, Technique `FadingVideo Crossfade Loop`, with a 500 ms fade. Do not generate separate scene clips to build the background.
- **Fallback:** a poster frame extracted from the same approved video. On `prefers-reduced-motion`, pause video and show the poster.
- **Use of the five stills:** `scene-01-quote-v2.png` is an identity/style anchor. `sequence-01-agreement.png`, `sequence-02-handoff.png`, `sequence-03-inspection-v2.png` and `sequence-04-recall.png` are chronological references. They are not separate website videos.

Until the MP4 is uploaded and inspected, keep the path and media metadata pending. Do not substitute the storyboard stills as the production video.

#### 1.5a Verified video metadata (recorded from the actual file)

Measured with `ffmpeg -i` against the real export. These are facts, not estimates.

| Property | Source export (`video/`) | Production web copy (`web/public/video/`) |
|---|---|---|
| Filename | `Creating_supplier_deal_video_sto._20261006235511.mp4` | `vendra-ambient-loop.mp4` |
| Container | MP4, `isom` / `isomiso2avc1mp41` | MP4, `isom` / `isomiso2avc1mp41`, `+faststart` |
| Duration | 00:00:08.00 (8.00 s) | 00:00:08.00 (8.00 s) |
| Dimensions | 1280 × 720 | 1280 × 720 |
| Frame rate | 24 fps | 24 fps |
| Video codec | H.264 **High** profile, yuv420p, 2351 kb/s | H.264 **Main** profile, yuv420p, 1183 kb/s |
| Audio track | AAC-LC 48 kHz stereo, 128 kb/s | **Removed** (`-an`) |
| File size | 2,494,578 bytes (2.38 MB) | 1,186,317 bytes (1.13 MB) |
| Colour tags | `tv`, smpte170m/bt709/iec61966-2-1, progressive | unchanged |
| Encoder | `Google` | `Lavf60.16.100` / `libx264` |

Poster: `web/public/video/vendra-ambient-loop-poster.jpg`, 1280 × 720, baseline JPEG, 61,644 bytes, extracted from frame 1 of the same export. It is a genuine frame from the approved video, not a substituted still.

**Deviation from the asset brief, recorded honestly.** The brief targeted 1080p minimum and a silent export. The approved source is **1280 × 720**, not 1080p, and it carried an AAC audio track. The resolution cannot be increased without regenerating the video, which is not permitted. The audio track was removed because the brief specifies a silent asset and an ambient background loop must never produce sound. Both facts are stated here rather than being papered over.

**Loop behaviour decision.** The export is a single continuous 8-second generation, not four concatenated clips, so native `loop` is used. No crossfade treatment is applied and no scene clips are generated. The first and last frames are the same continuous shot, so the native loop join is not visibly a cut.

**Web budget.** 1.13 MB is comfortably inside the 10 MB target. The 52% reduction came from dropping the unused audio track and re-encoding to Main profile at CRF 23. `preload="auto"` plus `poster` is retained; `navigator.connection` save-data and reduced-motion paths still skip loading entirely.

### 1.6 Video background and grain layers

```text
VIDEO WRAPPER:
  fixed inset-0 z-0 h-dvh w-full overflow-hidden pointer-events-none bg-[var(--bg-primary)]
VIDEO:
  absolute inset-0 h-full w-full object-cover object-[64%_center]
LIGHT WASH:
  absolute inset-0 z-[1] bg-[rgba(244,246,244,0.24)]
LEFT TEXT-SAFE GRADIENT:
  absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(244,246,244,0.48)_0%,rgba(244,246,244,0.25)_46%,rgba(244,246,244,0.08)_100%)]
GRAIN:
  fixed inset-0 z-[3] pointer-events-none opacity-[0.035]
```

Use an embedded SVG fractal-noise data URI for the grain, not an external image or CSS filter that blurs the text. Use a single composite wash element if the implementation can preserve the same colour values. The video must remain visible through page gutters and translucent cards.

Video element behaviour: `autoPlay`, `muted`, `playsInline`, `preload="auto"`; pause/resume control is keyboard accessible. Add `poster` from the approved video. When `prefers-reduced-motion: reduce`, do not autoplay. On clients that expose `navigator.connection`, skip video source loading and autoplay when `saveData` is true or `effectiveType` is `slow-2g`, `2g` or `3g`; keep the poster as the visual fallback. If that API is unavailable, use the normal video behavior. If autoplay is rejected by the browser, keep the poster and the page fully usable.

### 1.7 Motion primitives

Motion intensity is deliberately low. Do not use scroll hijacking, pinned stacks, cursor magnets, 3D tilts, parallax, auto-scrolling marquees or decorative number counters.

**Default section reveal:**

```text
initial: { filter: 'blur(10px)', opacity: 0, y: 16 }
animate: { filter: 'blur(0px)', opacity: 1, y: 0 }
transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: sectionDelay }
viewport: { once: false, amount: 0.1 }
```

**Grouped reveal:** same initial/animate states, `delay = baseDelay + index * 0.08s`, duration `0.42s`, ease `[0.16, 1, 0.3, 1]`, `viewport once:false amount:0.1`.

**Hover:** `translateY(-2px)` and border/shadow change over `220ms`, no tilt. All hover states use CSS transitions.

**Repeat rule:** every viewport entrance replays on re-entry, down and up. Never use `viewport={{ once: true }}`. For reduced motion, remove blur and translation, preserve content and set duration to `0ms`.

### 1.8 Liquid glass utility for the fixed navigation

Use the Step 3B liquid-glass border treatment only on the compact fixed navigation pill. Do not apply backdrop blur to scrolling cards, section surfaces or product panels. This keeps the effect meaningful and avoids repaint cost while scrolling.

```css
.liquid-glass-nav {
  background: rgba(251, 252, 251, 0.82);
  background-blend-mode: luminosity;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.32);
  position: relative;
  overflow: hidden;
}

.liquid-glass-nav::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.20) 22%,
    rgba(255,255,255,0) 48%, rgba(255,255,255,0) 58%,
    rgba(255,255,255,0.20) 82%, rgba(255,255,255,0.52) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

The pseudo-element is decorative and does not alter focus, pointer or screen-reader behaviour. The compact nav is the only page component using the liquid-glass class.

## 2. Navigation: Gate 2 A2 scroll-morph pill

**Pattern:** A2 scroll-morph pill from `FRONTEND_SKILL.md`. Starts as a transparent wide bar at the top, then becomes a compact floating pill after scroll position exceeds 80px. Full links move into a drawer. There is no brand symbol.

### Expanded top-of-page state

```text
Shell: fixed inset-x-0 top-0 z-50 h-20 px-5 md:px-8 lg:px-12
       flex items-center justify-between bg-transparent border-b border-transparent
Wordmark: text-2xl md:text-[1.75rem] font-display font-semibold tracking-[-0.04em] text-[var(--text-primary)]
Links: hidden md:flex items-center gap-7 text-sm font-body font-medium text-[var(--text-secondary)]
Link hover: text-[var(--text-primary)] transition-colors duration-[120ms]
Primary CTA: inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)]
            px-5 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)]
            hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)]
            transition-all duration-[220ms]
Pause control: inline-flex size-11 items-center justify-center rounded-full
               border border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)]
               hover:bg-[var(--bg-surface)] transition-colors duration-[120ms]
Mobile menu trigger: md:hidden inline-flex size-11 items-center justify-center rounded-full
                     border border-[var(--border-default)] bg-[var(--surface-muted)]
                     text-[var(--text-primary)] hover:bg-[var(--bg-surface)]
                     transition-colors duration-[120ms]
```

Expanded links: `How it works` to `#deal-timeline`, `Deal memory` to `#recall-demo`, `FAQ` to `#faq`. Wordmark text: `Vendra`. CTA: `Try Vendra`. Video control accessible name: `Pause background video` or `Play background video` according to state.

### Compact state after 80px scroll

```text
Shell: fixed left-1/2 top-3 z-50 -translate-x-1/2
       flex min-h-14 w-[calc(100%-2rem)] max-w-[1200px] items-center justify-between
       rounded-full liquid-glass-nav px-3 py-2 shadow-[var(--shadow-sm)]
       transition-all duration-[220ms] ease-[var(--ease-precision)]
Wordmark: px-3 text-lg font-display font-semibold tracking-[-0.04em] text-[var(--text-primary)]
Controls: flex items-center gap-2
Menu trigger: inline-flex min-h-10 items-center justify-center gap-2 rounded-full
              px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]
              transition-colors duration-[120ms]
CTA: inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--accent)]
     px-4 py-2 text-xs font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)]
     transition-all duration-[220ms] hover:bg-[var(--accent-hover)] md:text-sm
```

Transition threshold: `scrollY > 80px`. Morph uses a Framer Motion layout transition, duration `0.22s`, ease `[0.16, 1, 0.3, 1]`. The expanded links disappear into the drawer. The compact pill retains wordmark, background pause control, menu trigger and primary CTA.

### Drawer

```text
Scrim: fixed inset-0 z-[52] bg-[rgba(36,42,39,0.42)] backdrop-blur-[2px]
Panel: fixed right-0 top-0 z-[55] flex h-dvh w-[min(88vw,380px)] flex-col
       border-l border-[var(--border-default)] bg-[var(--bg-surface)] px-7 py-8
       shadow-[var(--shadow-lg)]
Panel initial: { x: '100%', opacity: 0.96 }
Panel animate: { x: 0, opacity: 1 }
Panel exit: { x: '100%', opacity: 0.96 }
Enter transition: { type: 'spring', stiffness: 280, damping: 30 }
Exit transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
```

Drawer contents and classes:

```text
Close button: inline-flex size-11 items-center justify-center self-end rounded-full
              text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]
              hover:text-[var(--text-primary)] transition-colors duration-[120ms]
Close icon: inline SVG, size-5, stroke-width 1.5, aria-hidden="true"
Wordmark: mt-5 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]
Link list: mt-8 flex flex-col gap-1
Link row: flex min-h-12 items-center border-b border-[var(--border-subtle)]
          py-3 font-body text-base font-medium text-[var(--text-secondary)]
          hover:text-[var(--accent)] transition-colors duration-[120ms]
Primary CTA: mt-7 inline-flex min-h-12 items-center justify-center rounded-full
             bg-[var(--accent)] px-6 py-3 font-body text-sm font-semibold
             text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]
             focus-visible:outline focus-visible:outline-2
             focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]
Privacy note: mt-auto pt-8 max-w-[30ch] font-body text-xs leading-relaxed
              text-[var(--text-muted)]
Text: "Your shop’s supplier history stays private by default."
```

Link destinations: `How it works` to `#deal-timeline`, `Deal memory` to `#recall-demo`, `FAQ` to `#faq`. The drawer is not a destination for `Try Vendra`; that CTA routes to `/app`. Implement the panel as `role="dialog"`, `aria-modal="true"`, with a focus trap, initial focus on close, body-scroll lock and focus restoration to the trigger. Close on Escape, scrim click and route selection. The menu trigger has `aria-expanded`, `aria-controls` and a visible focus ring; its inline SVG has `aria-hidden="true"`. Do not use a hamburger image as a brand mark. No social-proof logos.

## 3. Landing page sections

### Section 1: Hero

**Recipe:** `editorial-asymmetric-hero` from `COMPOSITION_RECIPES.md`, adapted to the approved product-led layout and persistent fixed video. The open left area carries the headline. A compact evidence-led product panel sits bottom-right and must not obscure faces in the video more than necessary.

```text
Section stack: relative z-10 min-h-[100dvh] overflow-hidden
Layout: grid grid-cols-1 items-end gap-8 px-5 pb-10 pt-28
        md:px-8 md:pb-12 lg:grid-cols-12 lg:px-12 lg:pb-16
Left lead: relative z-10 lg:col-span-7 lg:self-start lg:pt-[13vh]
Right support: relative z-20 lg:col-span-5 lg:justify-self-end lg:self-end
```

Left content:

```text
Eyebrow: mb-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]
          md:text-[11px]
Text: "SUPPLIER DEAL MEMORY FOR INDEPENDENT RETAILERS"
Headline: max-w-[11ch] font-display text-5xl font-semibold leading-[0.92]
          tracking-[-0.045em] text-[var(--text-primary)] text-balance
          sm:text-6xl md:text-7xl lg:text-[5rem]
Text: "Know what you agreed."
Line break target: `Know what` / `you agreed.` so the headline remains two lines on desktop.
Subheading: mt-6 max-w-[46ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
            md:text-lg text-pretty
Text: "Vendra keeps the quote, agreed terms, delivery and outcome together, so your shop can check the history before buying again."
CTA row: mt-8 flex flex-wrap items-center gap-3 md:mt-10 md:gap-4
Primary: `Try Vendra`, href `/app`
Secondary: `See how it works`, href `#deal-timeline`
```

Primary CTA classes:

```text
inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3
font-body text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)]
transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]
hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2
focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]
```

Secondary CTA classes:

```text
inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)]
bg-[var(--surface-wash)] px-6 py-3 font-body text-sm font-semibold text-[var(--text-primary)]
transition-all duration-[220ms] hover:-translate-y-0.5
hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface)]
```

Product support panel:

```text
Panel: relative z-20 w-full max-w-[390px] justify-self-end rounded-2xl
       border border-[var(--border-default)] bg-[var(--surface-panel)] p-5
       shadow-[var(--shadow-lg)] md:p-6
Panel header: flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4
Panel label: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]
Text: "ILLUSTRATIVE FLOW"
Panel title: mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]
Event list: mt-4 flex flex-col gap-3
Event row: grid grid-cols-[1.25rem_1fr] gap-3
Step dot: mt-1 size-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent-soft)]
Event title: font-body text-sm font-semibold text-[var(--text-primary)]
Event detail: mt-0.5 font-body text-xs leading-relaxed text-[var(--text-secondary)]
```

Panel heading: `HOW ONE DEAL BECOMES MEMORY`. Rows: `Quote saved`, `Terms confirmed`, `Delivery checked`, `Recall in a later session`. The panel is an illustrative explanation of product flow, not a claim about a real customer or measured outcome.

Hero entrance values:

```text
Eyebrow: initial { filter: 'blur(8px)', opacity: 0, y: 8 }
         animate { filter: 'blur(0px)', opacity: 1, y: 0 }, duration 0.42s, delay 0.12s
Headline: initial { filter: 'blur(10px)', opacity: 0, y: 16 }
          animate { filter: 'blur(0px)', opacity: 1, y: 0 }, duration 0.42s, delay 0.20s
Subheading: initial { filter: 'blur(8px)', opacity: 0, y: 12 }
           animate { filter: 'blur(0px)', opacity: 1, y: 0 }, duration 0.42s, delay 0.30s
CTA row: initial { filter: 'blur(8px)', opacity: 0, y: 12 }
         animate { filter: 'blur(0px)', opacity: 1, y: 0 }, duration 0.42s, delay 0.40s
Product panel: initial { filter: 'blur(8px)', opacity: 0, y: 16, scale: 0.985 }
              animate { filter: 'blur(0px)', opacity: 1, y: 0, scale: 1 }, duration 0.42s, delay 0.32s
Ease for all: [0.16, 1, 0.3, 1]
```

Hero animation is page-load only. Reduced motion sets opacity to 1 immediately and removes transforms and blur.

### Section 2: Problem statement

**Recipe:** `full-width-statement` from `COMPOSITION_RECIPES.md`. Follow its typography-only layout and allowed single metadata line. No cards or invented metric.

```text
Section stack: relative z-10 flex items-center py-24 md:py-32 lg:py-40
Container: w-full max-w-[1280px] mx-auto px-5 md:px-8 lg:px-12
Statement: max-w-none font-display text-[clamp(2.5rem,7.2vw,6rem)] font-semibold
           leading-[0.95] tracking-[-0.04em] text-[var(--text-primary)] text-balance
Text: "A deal is more than a price."
Desktop line rule: keep on one line at 1280px and above by reducing only the fluid type size if needed.
Metadata: mt-6 max-w-[64ch] font-mono text-xs leading-relaxed tracking-[0.04em]
          text-[var(--text-secondary)] md:text-sm text-pretty
Text: "Quotes, accepted terms, deliveries and resolutions can live in different places."
```

Reveal: statement initial `{ filter:'blur(10px)', opacity:0, y:16 }`, animate `{ filter:'blur(0px)', opacity:1, y:0 }`, duration `0.42s`, delay `0.08s`, ease `[0.16,1,0.3,1]`, viewport `{ once:false, amount:0.1 }`. Metadata uses the same states and duration with delay `0.16s`. The statement reveals as a single phrase, not per-letter.

### Section 3: Deal timeline

**Recipe:** `architecture-layers` from `COMPOSITION_RECIPES.md`, adapted to the retailer’s four real deal moments. No scroll pinning.

```text
Section id: deal-timeline
Section stack: relative z-10 py-20 md:py-28 lg:py-32
Surface: bg-[var(--surface-wash)]
Container: max-w-[1280px] mx-auto px-5 md:px-8 lg:px-12
Header: flex max-w-[64ch] flex-col items-start gap-4
Header title: max-w-[22ch] font-display text-3xl font-semibold leading-tight
              tracking-[-0.035em] text-[var(--text-primary)] text-balance
              md:text-4xl lg:text-5xl
Text: "One deal. A record that stays connected."
Header body: max-w-[58ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]
             md:text-base text-pretty
Timeline grid: mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4
Card: min-h-[220px] rounded-xl border border-[var(--border-default)]
      bg-[var(--surface-muted)] p-5 shadow-[var(--shadow-sm)]
      transition-all duration-[220ms] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]
Card index: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]
Card title: mt-8 font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]
Card body: mt-2 max-w-[30ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]
```

Card copy:

1. `QUOTE` / `Save what the supplier offered and where it came from.`
2. `AGREED TERMS` / `Keep the accepted price, quantity and delivery terms together.`
3. `DELIVERY` / `Record what arrived against what was agreed.`
4. `ISSUE AND RESOLUTION` / `Keep the discrepancy and agreed outcome attached to the same deal.`

Each card uses default blur-in reveal with `delay = 0.08s + index * 0.08s`, duration `0.42s`, ease `[0.16, 1, 0.3, 1]`, viewport `{ once: false, amount: 0.1 }`. The index is an ordinal label, not a business metric.

### Section 4: Recall demo with evidence

**Recipe:** `split-image-text` from `COMPOSITION_RECIPES.md`, adapted so the right column is an evidence panel rather than photography. The demo is labelled illustrative and contains no invented retailer claims.

```text
Section id: recall-demo
Section stack: relative z-10 py-20 md:py-28 lg:py-32
Container: max-w-[1280px] mx-auto px-5 md:px-8 lg:px-12
Header: max-w-[62ch]
Eyebrow: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]
Text: "A MEMORY YOU CAN CHECK"
Title: mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.035em]
        text-[var(--text-primary)] md:text-4xl lg:text-5xl
Text: "Ask about the last deal. Open the evidence behind the answer."
Columns: mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5
Conversation panel: lg:col-span-7 rounded-2xl border border-[var(--border-default)]
                   bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-md)] md:p-7
Evidence panel: lg:col-span-5 rounded-2xl border border-[var(--border-default)]
                bg-[var(--surface-muted)] p-5 shadow-[var(--shadow-sm)] md:p-7
```

Conversation panel elements:

```text
Demo label: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]
User bubble: mt-5 ml-auto max-w-[34ch] rounded-2xl rounded-br-md bg-[var(--bg-secondary)]
            px-4 py-3 font-body text-sm leading-relaxed text-[var(--text-primary)]
Text: "What happened with my last order from this supplier?"
Answer block: mt-4 max-w-[58ch] rounded-2xl rounded-bl-md border border-[var(--border-subtle)]
              bg-[var(--bg-surface)] px-4 py-4 font-body text-sm leading-relaxed text-[var(--text-primary)]
Text: "I found the saved deal history. Open the agreed terms, delivery check and any recorded resolution below."
Source hint: mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px]
              uppercase tracking-[0.12em] text-[var(--text-muted)]
Text: "ILLUSTRATIVE EXAMPLE · SOURCES LINK TO DEAL EVENTS"
```

Evidence panel elements:

```text
Panel heading: font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]
Text: "Evidence used"
Source list: mt-4 flex flex-col gap-2
Source row: flex min-h-14 items-center justify-between gap-3 rounded-lg
            border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3
            transition-colors duration-[120ms] hover:border-[var(--accent-border)]
            hover:bg-[var(--bg-surface)]
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
Source label: font-body text-sm font-medium text-[var(--text-primary)]
Source type: font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]
Rows: "Quote record" / "DEAL EVENT"; "Agreed terms" / "DEAL EVENT"; "Delivery check" / "EVIDENCE LINK"
```

Clicking a source row opens its permitted deal event or evidence preview. Use a modal at `z-[60]`; focus returns to the triggering row after close. In a real account, replace illustrative copy with that retailer’s own sourced history. Never populate a live user’s screen with another shop’s demo memory.

Entrance: heading initial `{ filter:'blur(10px)', opacity:0, y:16 }`, animate `{ filter:'blur(0px)', opacity:1, y:0 }`, duration `0.42s`, delay `0.08s`, ease `[0.16,1,0.3,1]`, viewport `{ once:false, amount:0.1 }`. Conversation panel delay `0.16s`, evidence panel delay `0.24s`, same states and duration.

### Section 5: Outcomes ledger

**Recipe:** `asymmetric-bento-grid` from `COMPOSITION_RECIPES.md`, adapted to a truthful product ledger. No aggregate savings, made-up counts or testimonials.

```text
Section stack: relative z-10 py-20 md:py-28 lg:py-32
Surface: bg-[var(--surface-wash)]
Container: max-w-[1280px] mx-auto px-5 md:px-8 lg:px-12
Header: max-w-[58ch]
Title: font-display text-3xl font-semibold leading-tight tracking-[-0.035em]
        text-[var(--text-primary)] md:text-4xl lg:text-5xl
Text: "Keep the outcome beside the agreement."
Description: mt-4 font-body text-base leading-relaxed text-[var(--text-secondary)]
Text: "A deal is easier to act on when the quote, what arrived and how an issue ended stay connected."
Grid: mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12
Large card: lg:col-span-7 min-h-[280px] rounded-2xl border border-[var(--border-default)]
            bg-[var(--surface-panel)] p-6 md:p-8
Small card A: lg:col-span-5 min-h-[280px] rounded-2xl border border-[var(--border-default)]
              bg-[var(--surface-muted)] p-6 md:p-8
Small card B: md:col-span-1 lg:col-span-6 min-h-[220px] rounded-2xl border border-[var(--border-default)]
              bg-[var(--surface-muted)] p-6 md:p-8
Small card C: md:col-span-1 lg:col-span-6 min-h-[220px] rounded-2xl border border-[var(--border-default)]
              bg-[var(--accent-soft)] p-6 md:p-8
Card label: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]
Card title: mt-8 font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--text-primary)]
Card copy: mt-2 max-w-[42ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]
```

Cards:

- Large: `A deal timeline` / `Move from quote to outcome without losing the relationship between the events.`
- Small A: `Terms history` / `Compare only the terms your shop has actually recorded.`
- Small B: `Delivery evidence` / `Keep receipt, quantity and delivery notes beside the agreement.`
- Small C: `Resolution trail` / `Remember what was raised and what was agreed next.`

Animation: each card uses `{ filter:'blur(10px)', opacity:0, y:16 }` to `{ filter:'blur(0px)', opacity:1, y:0 }`, duration `0.42s`, ease `[0.16,1,0.3,1]`, delay `0.08s + index * 0.08s`, viewport `{ once:false, amount:0.1 }`.

### Section 6: Memory and access

**Recipe:** `split-image-text` from `COMPOSITION_RECIPES.md`, adapted to a permission and memory diagram. No generated photo, icon set or blockchain jargon in the retailer-facing copy.

```text
Section stack: relative z-10 py-20 md:py-28 lg:py-32
Container: max-w-[1280px] mx-auto grid grid-cols-1 items-center gap-8
           px-5 md:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12
Copy column: lg:col-span-6
Diagram column: lg:col-span-6
Heading: max-w-[12ch] font-display text-3xl font-semibold leading-[0.98]
         tracking-[-0.035em] text-[var(--text-primary)] text-balance md:text-4xl lg:text-5xl
Text: "Private by default. Shared only on your terms."
Body: mt-5 max-w-[48ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
Text: "Vendra keeps each shop’s deal history separate. The owner can invite staff. A supplier sees nothing unless the retailer chooses to share a specific record."
Bullets: mt-6 flex flex-col gap-3
Bullet row: flex items-start gap-3 font-body text-sm leading-relaxed text-[var(--text-secondary)]
Bullet mark: mt-1 size-2 shrink-0 rounded-full bg-[var(--accent)]
```

Bullets:

- `Each shop has its own separate deal memory.`
- `The owner decides which staff can access records.`
- `Suppliers see only records the retailer chooses to share.`

Diagram surface:

```text
Diagram: rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5
         shadow-[var(--shadow-md)] md:p-7
Diagram heading: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]
Text: "ACCESS MODEL"
Owner row: mt-5 flex items-center justify-between rounded-xl border border-[var(--accent-border)]
           bg-[var(--accent-soft)] px-4 py-4
Member row: mt-3 flex items-center justify-between rounded-xl border border-[var(--border-subtle)]
            bg-[var(--surface-muted)] px-4 py-4
Supplier row: mt-3 flex items-center justify-between rounded-xl border border-dashed
              border-[var(--border-default)] bg-transparent px-4 py-4
Label: font-body text-sm font-semibold text-[var(--text-primary)]
Status: font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]
Rows: "Shop owner" / "CONTROLS SHOP ACCESS"; "Invited team" / "PERMISSIONED"; "Supplier" / "NO ACCESS BY DEFAULT"
```

Reveal: left column initial `{ filter:'blur(10px)', opacity:0, x:-12 }`, animate `{ filter:'blur(0px)', opacity:1, x:0 }`, duration `0.42s`, delay `0.08s`; right column same with `x:12`, delay `0.16s`; ease `[0.16,1,0.3,1]`, viewport `{ once:false, amount:0.1 }`.

### Section 7: FAQ

**Layout:** split editorial, not a full-width generic accordion card. The first answer is open on arrival. Each answer may remain open while other answers are opened.

```text
Section id: faq
Section stack: relative z-10 py-20 md:py-28 lg:py-32
Container: max-w-[1280px] mx-auto grid grid-cols-1 gap-8 px-5 md:px-8
           lg:grid-cols-12 lg:gap-12 lg:px-12
Lead: lg:col-span-4
Accordion: lg:col-span-8
Lead title: max-w-[9ch] font-display text-3xl font-semibold leading-[0.98]
            tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl
Text: "Questions before the next order?"
Lead copy: mt-4 max-w-[30ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base
Accordion wrapper: border-t border-[var(--border-default)]
Item: border-b border-[var(--border-default)]
Question button: flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left
                  font-body text-base font-semibold text-[var(--text-primary)] md:text-lg
                  transition-colors duration-[120ms] hover:text-[var(--accent)]
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--accent)]
Chevron: inline SVG size-4 shrink-0 text-[var(--accent)] transition-transform duration-[220ms]
         rotate-180 when expanded, rotate-0 when collapsed; aria-hidden="true"
Answer panel: max-w-[68ch] pb-5 pr-8 font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base
```

FAQ content:

1. `What does Vendra remember?` (open by default) / `The supplier deal details your shop saves: the quote, accepted terms, delivery, issues and recorded resolutions. Answers link back to those records.`
2. `Do I need to stop using WhatsApp?` / `No. Vendra is designed to sit alongside the way you already speak with suppliers. Save the relevant message, note or evidence with the deal.`
3. `Can a supplier see my notes?` / `Not by default. A supplier has no access to your shop’s memory. You choose if and what to share.`
4. `Will Vendra order stock or message a supplier for me?` / `No. Vendra can prepare a sourced follow-up draft. You review it and decide what to send or buy.`
5. `What if Vendra cannot find a previous deal?` / `It should say that no saved record was found. It must not guess a price, term or outcome.`

**Accessibility contract:** each question is a `<button>` inside a heading element. Include `aria-expanded` and `aria-controls`; panel IDs are unique. Use `aria-labelledby` on the panel if it is rendered as a region. Enter and Space toggle the focused question. Keep focus visible. Do not close other open answers automatically.

Animation: question panel height `0 → auto`, opacity `0 → 1`, duration `0.22s`, ease `[0.16,1,0.3,1]`. Opening a panel does not move focus. First panel is open initially. No scroll reveal hides the first answer.

### Section 8: Final CTA

**Recipe:** `footer-video` from `COMPOSITION_RECIPES.md`, adapted. Do not add a second video asset. The same fixed ambient background remains behind this section.

```text
Section id: final-cta
Section stack: relative z-10 overflow-hidden py-24 md:py-32 lg:py-40
Surface: bg-[var(--surface-subtle)]
Container: max-w-[1280px] mx-auto grid grid-cols-1 items-end gap-8 px-5
           md:px-8 lg:grid-cols-12 lg:px-12
Lead: lg:col-span-8
Support: lg:col-span-4 lg:justify-self-end
Eyebrow: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]
Text: "START WITH ONE DEAL"
Heading: mt-3 max-w-[13ch] font-display text-4xl font-semibold leading-[0.94]
         tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl md:text-6xl
Text: "Bring the last supplier conversation into the next one."
Body: mt-4 max-w-[44ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
CTA wrapper: mt-7 flex flex-wrap gap-3 lg:mt-0 lg:justify-end
CTA: same primary button as hero, label `Try Vendra`, href `/app`
```

Reveal: heading default blur-in, duration `0.42s`, delay `0.08s`; body delay `0.16s`; CTA delay `0.24s`; viewport `{ once:false, amount:0.1 }`.

### Section 9: Footer

```text
Section stack: relative z-10 border-t border-[var(--border-default)]
Surface: bg-[var(--surface-glass)]
Container: max-w-[1280px] mx-auto flex flex-col gap-8 px-5 py-8 md:px-8
           lg:flex-row lg:items-center lg:justify-between lg:px-12
Wordmark: font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]
Footer note: mt-2 max-w-[38ch] font-body text-xs leading-relaxed text-[var(--text-muted)]
Text: "A private memory for the supplier deals your shop wants to remember."
Links: flex flex-wrap gap-x-6 gap-y-3
Link: font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]
      transition-colors duration-[120ms] hover:text-[var(--accent)]
Links: `How it works` to `#deal-timeline`, `FAQ` to `#faq`, `Privacy` to `/privacy` (a separate static route; publish only after its copy receives privacy/legal review). Contact address is pending user approval, so omit the Contact link until supplied
Bottom row: mt-2 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-5
           font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]
Text: `© 2026 Vendra` and `Starting in Delta State`
```

Footer has the text wordmark only. No icon, brand mark, logo or fabricated partner list.

## 4. Authenticated web application

This app interior is part of the frontend hand-off, not a deferred design task. It uses the same Vendra name, typography, palette, semantic status colours, rounded geometry and restrained motion as the approved landing page. It is an operational workspace: no ambient video, grain, liquid glass, marketing hero, decorative metrics, logo, or fabricated sample records in authenticated routes. Use solid neutral surfaces and clear dividers so deal history remains scannable. All example data in this section is UI copy or field labels, never seed data presented as a real shop’s history.

### 4.1 Routes and access

| Route | Screen | Access |
|---|---|---|
| `/sign-in` | Sign in or create account | Public |
| `/onboarding` | Create first shop and initialise its separate memory scope | Authenticated user with no active shop |
| `/app` | Overview and quick actions | Active shop member |
| `/app/deals` | Searchable deal register | Active shop member |
| `/app/deals/new` | Three-step deal capture | Member with deal-create permission |
| `/app/deals/[dealId]` | Deal timeline, evidence and follow-up actions | Member of the deal’s shop with read permission |
| `/app/ask` | Cross-session recall and source inspection | Active shop member |
| `/app/suppliers` | Shop-local supplier directory | Active shop member |
| `/app/team` | Invitations and permissions | Owner or manager; read-only membership view for staff if enabled |
| `/app/settings` | Shop details and memory status | Owner or manager; staff see only permitted profile details |
| `/app/settings/privacy` | Export and deletion request status | Shop owner |

Unauthenticated requests to `/app/*` go to `/sign-in` with a safe `returnTo` route. Re-check membership and resource ownership on the server; hiding a link is not access control. Meaningful filters and event anchors must be deep-linkable. Returning from a deal detail to the register restores filters, scroll position and query. After every route change, move focus to the main page heading. No supplier account or supplier-facing route exists in V1.

### 4.2 App shell and navigation

The authenticated shell is independent of the marketing A2 scroll-morph nav. At desktop widths use a 240px sidebar and fluid content. Below `lg`, remove the sidebar and use a five-item labelled bottom tab bar, with `More` opening team/settings links. Keep all primary actions visible on small screens.

```text
App root: min-h-dvh bg-[var(--bg-primary)] font-body text-[var(--text-primary)] antialiased
Shell: min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]
Sidebar: sticky top-0 hidden h-dvh flex-col border-r border-[var(--border-default)]
         bg-[var(--bg-surface)] px-4 py-6 lg:flex
Wordmark: px-3 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]
Shop switcher: mt-7 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg
              border border-[var(--border-default)] bg-[var(--surface-panel)] px-3
              text-left text-sm font-medium text-[var(--text-primary)]
Primary nav: mt-7 flex flex-col gap-1
Nav item: flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium
          text-[var(--text-secondary)] transition-colors duration-[120ms]
          hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]
Nav active: bg-[var(--accent-soft)] text-[var(--accent)]
Nav icon: inline SVG size-5 shrink-0 stroke-width 1.6 aria-hidden="true"
Sidebar settings: mt-auto border-t border-[var(--border-subtle)] pt-4
Main column: min-w-0
Desktop/mobile topbar: sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4
                     border-b border-[var(--border-default)] bg-[var(--surface-panel)]
                     px-4 md:px-8
Topbar breadcrumb: min-w-0 truncate font-body text-sm text-[var(--text-secondary)]
Profile button: inline-flex size-10 shrink-0 items-center justify-center rounded-full
                border border-[var(--border-default)] bg-[var(--surface-muted)]
                text-sm font-semibold text-[var(--text-primary)]
Mobile wordmark: lg:hidden font-display text-xl font-semibold tracking-[-0.04em]
                 text-[var(--text-primary)]
Mobile shop switcher: inline-flex min-h-10 items-center gap-2 rounded-lg px-3
                      font-body text-xs font-medium text-[var(--text-secondary)]
                      hover:bg-[var(--bg-secondary)] lg:hidden; show only for multiple shops
Page container: mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8
Mobile tab bar: fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t
                border-[var(--border-default)] bg-[var(--surface-panel)]
                pb-[env(safe-area-inset-bottom)] lg:hidden
Tab item: flex min-h-14 flex-col items-center justify-center gap-1 px-1
          text-[10px] font-medium text-[var(--text-muted)]
Tab active: text-[var(--accent)]
Tab icon: inline SVG size-5 stroke-width 1.6 aria-hidden="true"
```

Desktop sidebar labels are `Overview`, `Deals`, `Ask Vendra`, `Suppliers`, `Team`; settings is anchored at the bottom. Mobile tabs are `Home`, `Deals`, `Ask`, `Suppliers`, `More`. `More` opens a labelled sheet with `Team`, `Settings`, `Privacy and data`, and `Sign out`. The sheet uses `role="dialog"`, `aria-modal="true"`, a focus trap, Escape/click-outside close, body scroll lock, and focus restoration. The shop switcher is omitted when the user has only one shop; never show an empty or fake switcher. Use inline SVG for icons only, no icon font or emoji. No brand symbol beside the Vendra wordmark.

**App z-index map:**

```text
z-0:     no background video or decorative canvas on app routes
z-10:    app page content and ordinary deal rows
z-20:    sticky app topbar and sidebar controls
z-30:    dropdown menus, tooltips and filter popovers
z-50:    mobile tab bar
z-[52]: mobile app-sheet scrim
z-[55]: app More sheet panel
z-[60]: standard dialogs, destructive confirmation and source preview modal
```

### 4.3 Shared app components and states

```text
Page header: mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between
Page title: font-display text-3xl font-semibold leading-tight tracking-[-0.035em]
            text-[var(--text-primary)] md:text-4xl
Page description: mt-2 max-w-[64ch] font-body text-sm leading-relaxed
                  text-[var(--text-secondary)] md:text-base
Section heading: font-display text-xl font-semibold tracking-[-0.02em]
                 text-[var(--text-primary)] md:text-2xl
Primary button: inline-flex min-h-11 items-center justify-center gap-2 rounded-full
                bg-[var(--accent)] px-5 py-2.5 font-body text-sm font-semibold
                text-[var(--text-on-accent)] transition-colors duration-[120ms]
                hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40
Secondary button: inline-flex min-h-11 items-center justify-center gap-2 rounded-full
                  border border-[var(--border-strong)] bg-[var(--surface-panel)] px-5 py-2.5
                  font-body text-sm font-semibold text-[var(--text-primary)]
                  transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]
Quiet action: inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3
              font-body text-sm font-medium text-[var(--text-secondary)]
              transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]
Danger action: inline-flex min-h-11 items-center justify-center rounded-lg
              border border-[var(--error)] bg-[var(--error-soft)] px-4 py-2
              font-body text-sm font-semibold text-[var(--error)]
Field label: mb-1.5 block font-body text-sm font-medium text-[var(--text-primary)]
Text input/select: min-h-11 w-full rounded-lg border border-[var(--border-default)]
                   bg-[var(--bg-surface)] px-3.5 py-2.5 font-body text-sm
                   text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                   transition-colors duration-[120ms] hover:border-[var(--border-strong)]
                   focus:border-[var(--accent)] focus:outline-none focus:ring-2
                   focus:ring-[var(--accent-soft)]
Select modifier: appearance-none pr-10
Checkbox: size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--accent)]
File dropzone: flex min-h-36 w-full flex-col items-center justify-center gap-2
              rounded-xl border border-dashed border-[var(--border-strong)]
              bg-[var(--surface-wash)] p-5 text-center
              hover:border-[var(--accent-border)] transition-colors duration-[120ms]
Textarea: min-h-28 w-full resize-y rounded-lg border border-[var(--border-default)]
          bg-[var(--bg-surface)] px-3.5 py-3 font-body text-sm leading-relaxed
          text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
          focus:border-[var(--accent)] focus:outline-none focus:ring-2
          focus:ring-[var(--accent-soft)]
Field help: mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]
Field error: mt-1.5 font-body text-xs leading-relaxed text-[var(--error)]
Status badge: inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5
              py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em]
Status neutral: border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]
Status accent: border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]
Status info: border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]
Status warning: border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]
Status error: border-[var(--error)] bg-[var(--error-soft)] text-[var(--error)]
Status success: border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]
Neutral row: border-b border-[var(--border-subtle)]
Loading skeleton: animate-pulse rounded-md bg-[var(--bg-secondary)]
Dialog scrim: fixed inset-0 z-[59] bg-[rgba(36,42,39,0.5)]
Dialog panel: fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-2rem)]
              w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto
              rounded-2xl border border-[var(--border-default)]
              bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)] md:p-7
Dialog title: font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]
Dialog close: inline-flex size-10 items-center justify-center rounded-full
              text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]
              accessible name `Close dialog`; inline SVG size-4 aria-hidden="true"
Dialog footer: mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)]
              pt-4 sm:flex-row sm:justify-end
App More scrim: fixed inset-0 z-[52] bg-[rgba(36,42,39,0.42)]
App More sheet: fixed inset-x-0 bottom-0 z-[55] max-h-[80dvh] overflow-y-auto
                rounded-t-2xl border border-[var(--border-default)]
                bg-[var(--bg-surface)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6
```

In this authenticated section, `shared primary button`, `shared text input/select`, `shared textarea`, `shared empty state` and `shared table rows` mean the full classes and behavior defined above, with only the route-specific modifiers written beside them. Do not substitute a different component style.

Dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, initial focus on the heading or first field, Escape close unless a destructive operation is processing, and focus restoration to the trigger. Animate scrim opacity `0 → 1` in `0.14s`. Panel enters from `{ opacity:0, scale:0.98, y:8 }` to `{ opacity:1, scale:1, y:0 }` with spring `{ stiffness:300, damping:25 }`; exit takes `0.12s`, around 65% of entry. The app More sheet enters from `{ y:'100%' }` to `{ y:0 }` with the same spring; exit is `0.12s`. Under reduced motion, show/hide without travel or scale.

Associate every input error with its field through `aria-describedby`; validate on blur, focus the first invalid field after submit, and preserve draft values. Disabled controls use the `disabled` attribute. Every successful save has visible confirmation within 300ms. Error copy states both cause and recovery. Use `role="status"` for asynchronous memory sync and polite save messages, `role="alert"` for blocking errors, and a labelled progress indicator for the three-step form. No spinner-only loading. On route entry, use a restrained blur-in transition: enter `{ filter:'blur(6px)', opacity:0, x:12 }` to `{ filter:'blur(0px)', opacity:1, x:0 }`, `0.20s`, ease `[0.16,1,0.3,1]`; back navigation reverses the x direction. Exit is `0.12s`. It is interruptible and respects reduced motion. Do not run scroll-reveal animations on deal tables or timeline rows; preserve scan stability.

**Shop memory disclosure slot:** every onboarding/settings memory panel must render the implementation-selected, verified custody explanation. Use one of these as a starting copy pattern and replace only with facts proven by the integration:

- Retailer-held: `Your shop controls its Walrus owner account. Vendra uses a delegated key for the operations described here. You can review and revoke that access using the steps below.` Show the revocation steps only when implemented and tested.
- Service-managed: `For this pilot, Vendra’s service controls this shop’s Walrus owner account. The shop has a separate memory scope, but the owner key is not held by you.`

Never ship generic wording that implies the retailer holds the key when they do not. The build agent selects, verifies and documents the applicable copy, then includes the real deletion and retention limits.

### 4.4 Sign-in and shop onboarding

#### `/sign-in`

```text
Auth canvas: min-h-dvh grid place-items-center bg-[var(--bg-primary)] px-4 py-10
Auth column: w-full max-w-[440px]
Wordmark: mb-8 text-center font-display text-3xl font-semibold tracking-[-0.04em]
           text-[var(--text-primary)]
Auth panel: rounded-2xl border border-[var(--border-default)]
            bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-sm)] md:p-8
Heading: font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]
Body: mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]
Form: mt-6 flex flex-col gap-4
Primary button: shared primary button, full width
Legal note: mt-6 font-body text-xs leading-relaxed text-[var(--text-muted)]
```

Copy: heading `Sign in to Vendra`; body `Keep your shop’s supplier deals together, from quote to resolution.` The credential field label and verification steps match the single auth method the build agent selects for the pilot. Render only that method, not a chooser of providers. Do not require a Sui wallet just to create a Vendra login unless the verified custody mode genuinely requires owner signing; if so, explain the separate memory-setup step in plain language. Provide `Create an account` and `Back to sign in` as text links. Implement only the configured auth method’s error states, such as expired link or OTP, invalid credential and rate limit, with field-level copy and a retry path. Never expose service credentials or raw delegate keys.

#### `/onboarding`

Use a two-step progress indicator: `1. Your shop`, `2. Deal memory`. On mobile, show `Step 1 of 2` with the current title so it does not wrap. The form panel is `mx-auto w-full max-w-[720px] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-sm)] md:p-8`. Step 1 heading `Set up your shop`; fields `Shop name` (required), `Market or area` (optional), `Currency` (`NGN` selected), and `Timezone` (`Africa/Lagos` selected). Do not infer or force a Delta city. CTA `Continue`. Step 2 heading `Set up deal memory`; show the shop-isolation statement, the selected custody disclosure, and a `Memory setup` status of `Setting up`, `Ready`, or `Needs attention`. CTA `Finish setup` is available only when the server reports the correct shop scope is ready. If setup fails, keep the shop record and offer `Retry setup` without claiming recall is active. Show a link to privacy information; do not ask the retailer to copy or paste a seed phrase into Vendra.

### 4.5 Overview, deals register and deal capture

#### `/app` overview

Page heading `Overview`; description `Your supplier deals, from quote to outcome.` Actions: primary `New deal` to `/app/deals/new`, secondary `Ask about a past deal` to `/app/ask`. A `Recent deals` section is a divider-separated list, not a grid of vanity metric cards. Each row shows the actual supplier label, deal headline, last event date and text status, linked to the detail route. Include an optional `Needs attention` group only when real records have `part_delivered` or `issue_open` status. Never render assumed counts, savings, recommendations or a fake sample order.

```text
Overview quick actions: mt-6 flex flex-wrap gap-3
Recent section: mt-10 border-t border-[var(--border-default)]
Recent header: flex items-center justify-between gap-4 py-4
Recent row: grid grid-cols-1 gap-1 border-b border-[var(--border-subtle)] py-4
            transition-colors duration-[120ms] hover:bg-[var(--surface-wash)]
            sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6
Supplier/deal: min-w-0 font-body text-sm font-semibold text-[var(--text-primary)]
Event detail: mt-1 truncate font-body text-xs text-[var(--text-secondary)]
Date: font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]
Empty state: mt-8 rounded-xl border border-dashed border-[var(--border-strong)]
             bg-[var(--surface-wash)] px-5 py-8 text-center md:px-8 md:py-10
Empty title: font-display text-xl font-semibold text-[var(--text-primary)]
Empty body: mx-auto mt-2 max-w-[48ch] font-body text-sm leading-relaxed
            text-[var(--text-secondary)]
Empty action: shared primary button, label `Start with a deal`
```

Empty copy: `Your first supplier deal starts here.` / `Save a recent quote or agreed order. You can add the delivery and any resolution later.` No illustration asset is required. If a shop has suppliers but no deals, the CTA opens `/app/deals/new` with its supplier selector ready.

#### `/app/deals`

Header `Deals` / `Search the quotes, terms, deliveries and outcomes your shop has recorded.` Primary action `New deal`. Search input placeholder `Search supplier or deal`; labelled filters `Status`, `Supplier`, `Date`. Applying a filter updates the URL query; provide `Clear filters`. Desktop is a semantic table with columns `Supplier and deal`, `Last event`, `Status`, `Updated`; on narrow screens convert each row to a stacked list with those labels, not horizontal scrolling. Sort recent activity first by default. Preserve filter and scroll state when opening and returning from a deal.

```text
Filter row: mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]
Search: shared text input with inline SVG search icon; icon aria-hidden="true"
Filter control: shared select/input classes, min-h-11
Table wrapper: border-t border-[var(--border-default)]
Table: w-full border-collapse text-left
Table header: border-b border-[var(--border-default)] font-mono text-[10px]
              uppercase tracking-[0.1em] text-[var(--text-muted)]
Table head cell: px-3 py-3 first:pl-0
Table row: border-b border-[var(--border-subtle)] transition-colors duration-[120ms]
           hover:bg-[var(--surface-wash)]
Table cell: px-3 py-4 align-middle first:pl-0
Mobile deal row: grid grid-cols-1 gap-2 border-b border-[var(--border-subtle)] py-4 sm:hidden
Empty state: shared empty state with title `No deals match these filters.`
Empty action: quiet action `Clear filters` or primary `Create a deal`, depending on whether filters are active
```

Map statuses to both text and semantic colour: `Draft` (neutral), `Quote saved` (info), `Terms agreed` (accent/neutral), `Part delivered` (warning), `Delivered` (success), `Issue open` (error), `Resolved` (success), `Cancelled` (neutral). Never use colour without the label. A first-time shop sees `No deals yet` and a primary `Create your first deal` action. Loading uses 5 divider rows, not a blank table. Server error preserves search/filters and shows `We couldn’t load these deals. Check your connection and try again.`

#### `/app/deals/new` deal capture

A three-step form: `Supplier and quote`, `Agreed terms`, `Evidence and review`. Show labelled progress and back navigation. Auto-save the canonical draft on valid blur or step change and show `Saving draft`, `Draft saved`, or a recoverable save error. Do not write to Walrus until the retailer confirms a factual deal event. Keep the current step and values on validation or network error.

```text
Wizard: mx-auto w-full max-w-[900px]
Wizard header: mb-6 flex flex-col gap-2
Progress: mb-7 grid grid-cols-3 gap-2
Progress item: border-t-2 border-[var(--border-default)] pt-2 font-mono text-[10px]
               uppercase tracking-[0.08em] text-[var(--text-muted)]
Progress active: border-[var(--accent)] text-[var(--accent)]
Form panel: rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)]
            p-5 shadow-[var(--shadow-sm)] md:p-8
Form section: grid grid-cols-1 gap-4 md:grid-cols-2
Full width field: md:col-span-2
Line item list: mt-5 border-t border-[var(--border-default)]
Line item row: grid grid-cols-1 gap-3 border-b border-[var(--border-subtle)] py-4
               md:grid-cols-[minmax(0,1fr)_120px_120px_140px_auto] md:items-end
Wizard footer: mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5
              sm:flex-row sm:items-center sm:justify-between
```

**Step 1 fields:** `Supplier` (searchable shop-local selector), `Add supplier` opens the supplier dialog, `Deal date` (default local date, editable), item rows with `Product or item`, `Quoted quantity`, `Unit`, `Quoted unit price`. `Add another item` appends a row. Currency is shown from the shop setting, not inferred. **Step 2 fields:** optional `Terms match the quote` checkbox; editable `Agreed quantity`, `Unit`, `Agreed unit price`, `Expected delivery date` and `Delivery note`. If terms are not final, provide `Not agreed yet`; save as a quote without implying agreement. **Step 3:** private evidence upload dropzone with button `Add quote or receipt`, accessible file input, current upload state and server-supported file types/limits before upload. Review the supplier, quoted and agreed fields, delivery plan, and evidence list. CTA `Save deal`; secondary `Save draft`. Show an exact success message and link to the saved deal. File extraction, if implemented, is labelled `Suggested from file` and each field requires retailer confirmation. Never write an unconfirmed extraction to durable memory.

### 4.6 Deal detail and event capture

#### `/app/deals/[dealId]`

Show breadcrumb `Deals / [Supplier]`, page title from the deal headline, supplier label, local deal date and status badge. Header actions: `Record delivery`, `Log an issue`, and an overflow menu with permitted edit/export actions. Do not offer `Mark resolved` unless an issue is open. Use two columns at `lg`: timeline spans 7 columns and evidence/details span 5. Stack timeline then evidence on mobile.

```text
Detail columns: mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10
Timeline column: lg:col-span-7
Evidence/details column: lg:col-span-5
Timeline list: border-l border-[var(--border-default)] pl-5
Timeline item: relative border-b border-[var(--border-subtle)] py-5
Timeline marker: absolute -left-[1.58rem] top-6 size-3 rounded-full border-2
                border-[var(--bg-primary)] bg-[var(--accent)]
Event label: font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]
Event title: mt-1 font-display text-lg font-semibold text-[var(--text-primary)]
Event body: mt-1 font-body text-sm leading-relaxed text-[var(--text-secondary)]
Event metadata: mt-2 font-mono text-[10px] text-[var(--text-muted)]
Evidence panel: border-t border-[var(--border-default)]
Evidence row: flex min-h-14 items-center justify-between gap-3 border-b
              border-[var(--border-subtle)] py-3 font-body text-sm
```

Timeline order is chronological. Each event shows type, recorded/occurred date, user-confirmed summary, changed deal fields and associated evidence. Clicking evidence opens a permission-checked preview modal at `z-[60]`; raw object keys and long-lived URLs are never shown. Editing a past event creates a correction event and retains the original. The empty evidence panel says `No evidence attached to this deal yet.` with a role-appropriate `Add evidence` action.

`Record delivery` modal fields: `Date received`, per-line `Quantity received`, `Condition` (`As agreed`, `Short`, `Damaged`, `Other`), optional `Note`, and `Add delivery evidence`. `Log an issue` fields: `Issue type`, `What happened?`, `Date noticed`, optional evidence. A separate `Record resolution` action appears only when the issue exists and captures `Outcome agreed`, `Resolved on`, and optional evidence. All modals share accessible dialog behavior, field validation, visible close control, focus trap/restoration, and a danger confirmation only for destructive operations. Successful event saves append to the timeline; memory sync is displayed separately as `Memory syncing`, `Memory ready`, or `Memory needs attention`.

### 4.7 Ask Vendra and supplier directory

#### `/app/ask`

Header `Ask Vendra`; description `Ask about a past quote, delivery, issue or resolution. Answers link back to the deal record.` On first use, show three starter prompt buttons: `What did I agree to pay last time?`, `Was the last delivery complete?`, `How was the last issue resolved?`. These are prompts, not seeded conversation. Desktop uses a 7/5 conversation/source layout; on mobile, source cards appear directly below the answer.

```text
Ask layout: grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8
Conversation column: lg:col-span-7
Source column: lg:col-span-5
Message list: flex flex-col gap-4
Question bubble: ml-auto max-w-[min(90%,520px)] rounded-2xl rounded-br-md
                bg-[var(--bg-secondary)] px-4 py-3 font-body text-sm leading-relaxed
                text-[var(--text-primary)]
Answer panel: max-w-[68ch] rounded-2xl border border-[var(--border-default)]
              bg-[var(--surface-panel)] p-5 font-body text-sm leading-relaxed
              text-[var(--text-primary)]
Composer form: sticky bottom-20 z-10 mt-6 border border-[var(--border-default)]
               rounded-xl bg-[var(--surface-panel)] p-3 shadow-[var(--shadow-sm)]
Composer input: shared textarea classes with `min-h-[88px] max-h-[220px]` replacing the base `min-h-28`
Send button: shared primary button, icon plus visible label `Ask`
Source list: mt-4 flex flex-col divide-y divide-[var(--border-subtle)] border-t
Source link: flex min-h-14 items-center justify-between gap-3 py-3
             font-body text-sm font-medium text-[var(--text-primary)]
             hover:text-[var(--accent)] transition-colors duration-[120ms]
```

A response is not shown as factual until it resolves to current canonical deal events; show source links with supplier, event type and date. No matching source: `I couldn’t find a saved record for that. Try another supplier, item or date.` Memory service unavailable: `Deal memory is temporarily unavailable. Your saved deals are still in the Deals list.` with links `Browse deals` and `Retry`. While a write is pending, distinguish `Deal saved` from `Memory syncing`; never imply a new fact is available to recall before sync completes. Keep chat input and prior answer if a request fails. The composer sends on button click or `Cmd/Ctrl+Enter`; plain Enter inserts a new line. Keyboard behavior is explained in the input help text. Do not display Walrus, model or blockchain jargon in ordinary retailer-facing answers.

#### `/app/suppliers`

Header `Suppliers`; description `Supplier details stay within this shop.` Button `Add supplier` opens a dialog with `Supplier name` (required), `Phone` (optional) and `Note` (optional). Use a divider-separated list/table with columns `Supplier`, `Last deal`, `Latest saved terms`, and `Open issue`. Any summary is computed from this shop’s canonical events and links to the source deal. Do not show a supplier rating or comparative score. Empty state title `No suppliers added yet`; body `Add the supplier from a recent quote or start a new deal.` CTA `Add supplier`. Use the same table and mobile stacked-row classes from `/app/deals`.

### 4.8 Team, settings and privacy

#### `/app/team`

Header `Team`; description `Choose who can work with this shop’s supplier records.` Owner/manager sees `Invite a team member`; staff see the member list but no invite/revoke controls. Table columns `Name`, `Access`, `Joined`, `Status`; mobile rows stack. Invite dialog asks for the account identifier required by the configured auth method and role (`Manager` or `Staff`), displays the effect of each permission, and sends only after explicit confirmation. Revoke is a separated danger action with a confirmation dialog. Membership changes show success or a recoverable error and are recorded in the audit log. If the owner has no members, show `You’re the only person in this shop` and `Invite a teammate when you’re ready.` with `Invite a team member` as the primary action. Never grant supplier access through team invitations.

#### `/app/settings` and `/app/settings/privacy`

Settings page groups: `Shop details` (editable shop name, market/area, currency and timezone), `Deal memory` (active/pending/degraded status and accurate owner/delegate custody disclosure), and `Team access` (link to `/app/team`). Hide billing and payment settings until paid billing is explicitly enabled. The `Privacy and data` group links to `/app/settings/privacy`.

```text
Settings group: border-t border-[var(--border-default)] py-5
Settings group title: font-display text-lg font-semibold text-[var(--text-primary)]
Settings group help: mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]
Settings content: mt-4 grid grid-cols-1 gap-4 md:grid-cols-2
Settings action row: flex flex-col gap-1 border-b border-[var(--border-subtle)] py-4
                     sm:flex-row sm:items-center sm:justify-between sm:gap-6
Settings value: font-body text-sm text-[var(--text-primary)]
Settings hint: mt-1 font-body text-xs leading-relaxed text-[var(--text-muted)]
```

Privacy page sections and controls: `Export shop data` with button `Request export`; `Delete shop data` with a separate danger-styled `Request deletion` action; current retention and custody notices drawn from verified implementation settings. Deletion states are `Request received`, `Awaiting owner authorisation` when a retailer signature is required, `Deletion in progress`, `Verifying deletion`, `Complete`, or `Blocked`. With no outstanding requests, show `No data requests yet.` and explain how export and deletion requests work. A request must never display `Complete` before the selected custody path has validly authorised Security Delete, the transaction succeeded, and supported post-delete retrieval/index checks passed. If a data layer cannot be verified, state which one is blocked and do not say the data has been erased. The user can navigate away and return to a durable status record; never collect a seed phrase in a text field.

### 4.9 App motion, assets and validation states

No app screen needs a photo, generated image, logo or background video. Use inline SVG icons and real retailer evidence only after permission checks. Do not show the five marketing video references in the app. The app shell uses no continuous animation. Route transitions are the single short blur-in specified above. Hover/focus changes use CSS transitions; modal/drawer interaction uses an interruptible spring (`stiffness:300`, `damping:25`), with exit duration 60-70% of enter. Reduced-motion mode removes route transforms/blur, modal travel and tab movement while preserving immediate state changes.

- **Loading:** skeletons for the page header, list rows and evidence details. For memory sync, show its own status and never block saving the relational deal record.
- **Empty:** every list and panel explains what is absent and offers one relevant, permission-appropriate action. No sample deals or fake memories.
- **Error:** show the failed operation and next step; preserve query, current form values and filter state. Separate upload, deal save, Walrus write, Walrus recall and model errors.
- **Permission:** hide unavailable actions and provide a clear explanation if a user follows a direct route without the required role.
- **Offline:** preserve an unsent draft locally only after disclosing local storage; mark it unsynced and never report it as saved remotely.
- **Status:** pair semantic colour with text; never rely on colour alone.
- **Navigation:** shareable URLs for deals and filtered registers; return restores state; focus moves to the page heading on route change.

## 5. Responsive behaviour

- **Marketing mobile, below `sm`:** one-column sections, 20px page gutters, hero headline `text-5xl`, product panel follows the lead content and stays within the first two viewports. Video keeps `object-[64%_center]` so both women remain in frame where possible. No horizontal overflow.
- **Marketing tablet, `md`:** timeline becomes two columns; FAQ remains editorial; nav uses compact pill and drawer.
- **Marketing desktop, `lg`:** 12-column content grid; hero lead occupies seven columns and support panel five; timeline has four columns; outcomes ledger uses asymmetric bento spans.
- **Authenticated mobile, below `lg`:** sidebar is replaced by five labelled bottom tabs; forms and detail pages are one column; deal table becomes labelled stacked rows; chat source list moves below the answer.
- **Authenticated desktop, `lg` and above:** 240px fixed sidebar, fluid main column, sticky 64px topbar. Form and detail grids use the 12-column patterns above.
- Every fixed width has a responsive cap. Landing drawer width is `w-[min(88vw,380px)]`. No app table forces horizontal scrolling.
- Touch targets are at least 44px for nav controls, CTA buttons, form controls, evidence rows and accordion buttons.

## 6. Accessibility and states

- Validate WCAG AA contrast for body copy and controls against representative video frames and translucent panels. Strengthen the local neutral wash or panel opacity if a frame fails; never lower the text contrast to preserve the video.
- Video is muted and has a visible keyboard-operable pause/resume control. Respect `prefers-reduced-motion` with poster-only behaviour.
- Provide a focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`.
- Do not convey deal status by colour alone. Pair semantic colour with text labels such as `Saved`, `Needs review` or `Resolved`.
- Chat answers always display source cards. A missing source is an explicit empty state, not a confident guess.
- Loading uses skeleton blocks, not spinners. Memory sync state is distinct from deal-save state.
- Error state preserves user input and names which operation failed: evidence upload, deal save, memory write or recall.

## 7. Composition recipe references

- Hero: `editorial-asymmetric-hero`, adapted to a light Swiss-rational product layout and the approved video layer.
- Problem: `full-width-statement`.
- Deal timeline: `architecture-layers`, adapted to quote, agreement, delivery and resolution.
- Recall demo: `split-image-text`, with evidence panel replacing the image.
- Outcomes ledger: `asymmetric-bento-grid`, adapted without fabricated metrics.
- Memory/access: `split-image-text`, with a text permission diagram.
- Final CTA: `footer-video`, adapted to the already-persistent video background.
- FAQ: bespoke split editorial accordion because no matching recipe is as accessible and specific.
- Authenticated screens: bespoke operational layouts with divider-led data density; no landing-page video, marketing sections or image recipes.

## 8. Specification coverage checklist (not implementation QA)

This list tracks planning-spec coverage only. Browser, asset, accessibility and product-flow verification still require implementation and the approved MP4.

- [x] Exact Tailwind classes are specified for principal elements and responsive changes.
- [x] Entrance animations specify initial state, final state, duration, ease, delay and repeat-on-re-entry behaviour for marketing sections.
- [x] Every section has a declared z-index relationship to its applicable background/shell.
- [x] The full-page video has an asset brief, fallback and pending-file status.
- [x] No extra logo or brand symbol is specified.
- [x] Composition recipes are named where applicable; bespoke sections use matching specificity.
- [x] The one-video story is not divided into separate per-still videos.
- [x] No testimonials, customer counts, savings or other unsupported proof are included.
- [x] The FAQ supports multiple open answers and follows the accessible accordion pattern.
- [x] Marketing scroll reveals replay whenever sections re-enter the viewport.
- [x] Authenticated routes now have screen layouts, states, responsive navigation and permission rules.
- [ ] Upload and inspect the approved MP4, then lock actual path, duration, dimensions, codec and size.
- [ ] Review the exact public copy and publish `/privacy` only after its text passes privacy/legal review; keep Contact hidden until the user supplies an address.
- [ ] User review and approval of the planning package is required before implementation.
