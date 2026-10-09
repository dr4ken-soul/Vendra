# Vendra — demo film direction

Mode B, Creation. Inputs: the Ebbryn reference system from
[`analysis/reference-analysis.md`](analysis/reference-analysis.md), and the real
product at `vendra-psycho-projects.vercel.app`.

---

## Step 1 — Ingest

```
SUBJECT   A shop's supplier deals, recorded once and recalled later from evidence
CLAIM     Vendra answers "what did we agree?" by citing the record, not memory
TENSION   Retailers lose the thread of a supplier across weeks of messages,
          calls and paper, then re-negotiate from scratch
```

The tension is not "chatbots are forgetful". It is the specific, ordinary moment
of a shopkeeper trying to remember what was agreed with a supplier three weeks
ago. That is the scene the film has to be recognisably inside.

## Step 2 — Declare intent

```
PURPOSE   award — argument with proof, submitted alongside a written submission
AUDIENCE  judges who have seen many hackathon demos and distrust them on sight
FEELING   recognition — the physical sensation of "that is exactly my week"
DURATION  100 seconds
PLATFORM  submitted video + linked from the repo; 16:9, 1920×1080
PROMISE   After watching, the judge will believe Vendra's answers come from the
          shop's own records rather than from a model, and that this was filmed
          on a running deployment rather than mocked up
```

**100s, not 60.** The 56s reference compresses; it has one thing to say. Vendra
has an argument with a time component — record, gap, recall — and compressing it
would cut the gap, which is the part that matters. 100s sits in the band the
references use for repeated claim → evidence → verdict, which is this film's shape.

## Step 3 — Category

**`evidence-demo` is the structural owner.** It owns the arc, the pacing and the
cut rhythm.

Contributing vocabulary only:

- from `product-ui-film` — the product behaves on camera; the cursor is the actor
- from `data-infographic` — numerals get a designed family treatment
- from `explainer` — one concept, taught by demonstration rather than assertion

Not `narrative-world`. The kibble reference's illustrated night skyline would make
this look like a film *about* a product. This is the product.

## Step 4 — Dimension and technique

```
DIMENSION 2D — graphic, flat, precise
TECHNIQUE  composite: real screen capture + deterministic type and layout
CONTROL   Everything the viewer reads, counts or compares is deterministic.
          Captured footage is real and unretouched. No generated imagery of the
          product, ever, including "improved" versions of it
```

The skill's rule is that AI is for atmosphere and unreliable for exact geometry
and text. There is no atmosphere here to generate. The whole film is text, numbers,
citations and a real interface, so every frame is deterministic.

## Step 5 — Visual language

### Palette — measured from `web/src/app/globals.css`, not chosen

```
GROUND    #f4f6f4   warm off-white, green cast — the app's --bg-primary
INK       #242a27   near-black, never pure black — --text-primary
ACCENT    #b9402e   terracotta — --accent. One per act, under ~10% of pixels
SUPPORT   #59635e   --text-secondary, for structure and hairlines
CONFIRM   #2f7654   --success, used only where a record resolved
WHY       These are Vendra's own product colours. A film that recoloured the
          product would be an advert for a version of it that does not exist,
          and the judge would see a different tool on submit
```

The skill prefers warm off-white over pure white and near-black over pure black
for a product register. The product already agrees, which is not a coincidence
worth fighting.

### Type role lock — three faces, three permanent jobs

| Role | Face | Job | Treatment |
|---|---|---|---|
| Display | Barlow | claims, the one word that carries the beat | 600–700, tracking −0.03em, 60–80% frame width |
| Machine voice | Azeret Mono | the date stamp, citations, event IDs, UI chrome | uppercase, tracking +0.20em, small, low contrast |
| Accent | Barlow italic | the single emphasised word per claim | set apart, never repeated in one beat |

Barlow and Azeret Mono are the app's actual faces. A demo with different type is
a demo of something else.

### Texture stack

Grain at low opacity, a soft vignette, and no chromatic aberration — aberration
reads as "generated" and this film is the opposite of generated. Applied uniformly
so captured footage sits in the same world as the type.

## Step 6 — Compose the frame

```
FOCAL POINT   the claim, or the answer box. Never both at equal weight.
HIERARCHY     three tiers, never four:
                eyebrow   mono caps, dim — where we are in the argument
                hero      the claim, or the real answer Vendra returned
                meta      the date stamp, top-left; the citation ticker, bottom
NEGATIVE      designed emptiness on the left of every claim frame. The type
              occupies 60–80% of width and the frame is quiet on the other side.
MARGINS       6% of frame width. Unbroken.
GRID          the persistent frame's geometry is identical in every shot
PERSISTENCE   three elements, present in every frame:
                1. the shop's deal spine — the record the film is about
                2. the real date stamp, advancing with the story
                3. the citation ticker, carrying real event references
```

**Persistence is load-bearing here, not decoration.** The skill's test is whether
removing it costs the viewer information. Remove the ticker and the film's central
promise — *the answer came from a real record* — has no visible proof. Remove the
date stamp and the time argument, which is the only thing Ebbryn does not have,
disappears.

## Step 7 — Structure

Arc: **Claim → Evidence → Verdict**, three cycles, with the time gap held between
the second and third.

| # | Beat | Job | Ground | ~Dur |
|---|---|---|---|---:|
| 1 | The question | the retailer asks what they agreed | light | 0–14s |
| 2 | The scatter | records in messages, calls, paper | light | 14–28s |
| 3 | **The record** | a deal captured, live, cursor doing it | light | 28–48s |
| 4 | **The gap** | *nothing happens. dates advance.* | light, emptiest frame in the film | 48–58s |
| 5 | **The recall** | ask Vendra; a grounded answer with citations | light | 58–82s |
| 6 | The proof | the citations resolve to real events | light | 82–94s |
| 7 | The verdict | what changes, and the honest limit | **dark** | 94–100s |

No two adjacent beats share a job.

**The ground changes exactly once, at beat 7**, and it means something: the film
has been showing the product working, and the final frame is the claim. The
skill's note is that a ground change with no change in the argument is decoration;
this one closes the argument.

**The logo arrives last and holds.** It is the conclusion, not the opening.

### Pacing

Measured across the references: a structural event every **0.7–0.9s**. This film
holds that rate in beats 1–3, 5 and 6, and **deliberately drops to near-nothing in
beat 4**. The skill says restraint only reads as premium if something else is
loud, which is why the emptiness is placed after the busiest stretch rather than
at the start.

## What this film will not claim

Stated here because the brief requires honest limits and the references model it —
Ebbryn puts "this plan didn't pass" in the cut rather than hiding it.

- It shows **one shop**. The film is not evidence of three users and must not be
  presented as such.
- The footage is from a **live deployment**, but recorded by the founder, not by a
  third party.
- The answer on screen must be **really returned by the deployed system**, with
  its real citations. If a recall cannot be made to produce a grounded answer on
  the day, the beat gets rebuilt around what it actually said. Nothing is faked to
  make the demo work.
- The sender address is a personal Gmail with no SPF alignment, so **mail may
  folder**. That is not a product claim and is not made in the film.
- Walrus deletion is unverified and the product reports it as blocked. The film
  does not imply otherwise.