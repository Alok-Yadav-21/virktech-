---
name: Virktech
description: A friendly local repair and device shop, phone first, drenched in one confident green.
colors:
  green-brand: "#007847"
  green-deep: "#005e35"
  green-night: "#00331c"
  green-bright: "#039256"
  green-tint: "#d9f7e4"
  green-mist: "#edf6f1"
  lime-action: "#b7f652"
  lime-soft: "#d1ff77"
  ink: "#091a11"
  ink-muted: "#4f5c54"
  surface: "#f8fbf9"
  line: "#d9e0dc"
  deal-coral: "#d7352d"
  danger: "#c2181d"
  info: "#006aa5"
  attention-bg: "#ffedb9"
  attention-ink: "#614100"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 9.5vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green-brand}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.green-deep}"
  button-lime:
    backgroundColor: "{colors.lime-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  chip:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.green-night}"
    textColor: "#ffffff"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "#ffffff"
    rounded: "14px"
    height: "48px"
---

# Design System: Virktech

## Overview

**Creative North Star: "The Neighbourhood Workbench"**

A good local repair bench is tidy, well lit and honest: you can see the tools, the price and the work in progress. The interface should feel the same. One confident green fills the storefront the way a shop-front sign does, everything else is clean white and soft green-grey, and every screen shows the price, the branch and the next step without making anyone hunt for them.

The system has two moods that share one set of parts. Where customers decide (home, shop, product, checkout) it is expressive: drenched green sections, big photography, a bold rounded headline. Where people get things done (the customer app, staff, admin) it goes quiet and familiar: white surfaces, thin borders, one green for the main action and the current state. Phone is the primary screen. Desktop is the same layout given more room.

**Key Characteristics:**
- One drenched green on the storefront; restrained everywhere else.
- Thumb first: a bottom tab bar, sticky action bars, 44px or larger targets, 16px or larger input text.
- Plain words and honest states (empty, loading, error, out of stock).
- Round, soft shapes: pill buttons, 16px cards, sheets that slide up from the bottom.
- Bootstrap 5 underneath, re-skinned with tokens; almost no bespoke CSS.

## Colors

A single saturated green carries the brand; lime marks the action on top of it; everything else is a green-tinted neutral. There is no cream or beige.

### Primary
- **Brand Green** (#007847): hero and band backgrounds, primary buttons, the current tab, links (as Deep Green), progress fills. White text on it is 5.56:1.
- **Deep Green** (#005e35): hover and pressed buttons, link text on white (7.6:1), the status "brand" pill text.
- **Night Green** (#00331c): footer, the sell band, selected chips, the darkest surface.
- **Bright Green** (#039256): a soft accent circle behind the hero only; never under text.

### Secondary
- **Action Lime** (#b7f652): the action button on a green surface (ink text, 14:1) and the progress fill on Night Green. Lime text on green is 4.3:1, so it is only ever used for large or bold text.

### Tertiary
- **Deal Coral** (#d7352d): price-drop tags and low-stock text only. White on it is 4.7:1.
- **Attention Amber** (#ffedb9 with #614100 text): "needs your action" cards and warning pills. 8:1.

### Neutral
- **Ink** (#091a11): text on white (17:1).
- **Muted Ink** (#4f5c54): secondary text (6.7:1).
- **Surface** (#f8fbf9): the page background, a true off-white with a trace of green.
- **Green Mist** (#edf6f1) and **Green Tint** (#d9f7e4): quiet fills for inputs, search, tinted cards, status pills.
- **Line** (#d9e0dc): 1px borders and dividers.

### Named Rules
**The One Voice Rule.** On a storefront screen, green is the colour and lime is the only second voice. Coral and amber appear in small doses and always with words, never as decoration.
**The Words-First Rule.** Status is always a pill with an icon and words. Colour only helps scanning.
**The Contrast Floor Rule.** Body text is 4.5:1 or better; large text 3:1. Check any new pairing before using it.

## Typography

**Display, Headline and Body:** Bricolage Grotesque (variable, self-hosted), falling back to the system sans. One family, carried by weight and size.

**Character:** Friendly with a little personality in the letterforms at large sizes, neutral and readable at small ones (its optical-size axis does that automatically).

### Hierarchy
- **Display** (800, clamp(2.5rem, 9.5vw, 4.25rem), 1.02): the home hero line only.
- **Headline** (700, 1.5rem, 1.2): page titles and section titles.
- **Title** (700, 1.1rem): card titles, product names in context.
- **Body** (400, 1rem, 1.5): all reading text; descriptions stay within about 65ch.
- **Label** (600, 0.8rem): pills, table heads, small captions. Nothing functional goes below 12px.

### Named Rules
**The No Squint Rule.** Inputs are 16px so phones do not zoom; functional text is never under 11px.
**The One Family Rule.** No second typeface. Contrast comes from weight and size.

## Layout

Mobile first on a 16px gutter. Page content sits in a Bootstrap `container`; horizontal rails bleed to the screen edge and scroll with snap. Phones have a fixed bottom tab bar (Home, Shop, Repair as a raised centre action, Basket, Account; the customer app has Home, Repairs, Book, Orders, Me) and a sticky action bar above it when a page has one decision (add to basket, checkout, approve a quote, book). From 768px the tab bar becomes a top navigation. Staff and admin use a fixed left sidebar on large screens and a slide-out drawer below that. Lists are tappable rows on phones and tables on wide screens. Spacing rhythm is 4, 8, 16, 24, 40; sections breathe with generous vertical gaps and tight groupings inside cards.

## Elevation & Depth

Flat by default: depth comes from white cards on the off-white page with a 1px border, not from shadows. Shadows appear only on things that float: the raised Repair tab (`0 8px 24px rgb(9 26 17 / 0.1)`), the sticky action bar (`0 -6px 20px rgb(9 26 17 / 0.06)`), hover on a linked card, and sheets and modals.

### Named Rules
**The Flat-Until-Floating Rule.** A surface that is part of the page has a border and no shadow.

## Shapes

Soft and round. Buttons and chips are pills. Cards are 16px, hero and bands 24 to 28px, inputs 14px, image tiles 20px. The brand mark is a rounded square with a V and a lime dot. Icons are 24px outline glyphs with a 1.75 stroke and round caps, drawn inline.

## Components

### Buttons
- **Shape:** pill (999px), 48px tall, 56px for the large variant; the small variant is 40px, or 44px on touch screens.
- **Primary:** Brand Green fill, white text; hover Deep Green; pressed Night Green. Pressing scales the button to 0.97.
- **Lime:** Action Lime fill with ink text, used on green surfaces.
- **Outline and ghost:** a neutral 1.5px border for secondary actions; red outline for destructive ones.

### Chips
- **Style:** white pill, 1.5px border, 44px tall, optional leading icon.
- **State:** selected is Night Green with white text. Used for categories, filters, device type and quick problem shortcuts.

### Cards and rows
- **Corner style:** 16px, white, 1px Line border, 16px padding, no shadow.
- **Variants:** tinted (Green Mist) for calm information, attention (Amber) for "needs you now".
- **Row card:** icon disc, two lines of text, a status pill, a chevron; the whole row is one tap target.

### Inputs
- **Style:** white, 1.5px border, 14px radius, 48px tall, 16px text.
- **Focus:** the border turns Brand Green with a soft 4px green ring. Labels are always visible above the field.

### Navigation
- **Bottom tab bar:** five equal slots, icon over label, the current tab in Deep Green with a short bar on its top edge; the Repair or Book slot is a raised green disc with a lime icon.
- **Top bar:** logo mark, search pill, branch pin, basket; links and a primary "Book a repair" button from 768px.

### Product card
- A 4:3 photo with a condition tag, a two-line name, bold price with strike-through old price and a coral percentage tag, and a green add button that sits on the photo.

### Status pill and progress
- A small pill with an icon (check, alert, cross for good, needs attention, stopped) and always words. Progress is a vertical numbered list where finished steps are green discs with a tick.

## Do's and Don'ts

### Do:
- **Do** keep the main action of every phone screen inside thumb reach, in a sticky bar when there is one decision.
- **Do** show price, branch and next step on any screen that has them.
- **Do** use Bootstrap utilities and react-bootstrap components first; add CSS only for what Bootstrap lacks.
- **Do** give every list an honest empty state and a loading skeleton, and every fetch an error state with a retry.
- **Do** respect `prefers-reduced-motion`; keep motion to a single calm hero entrance, press feedback, sheets and skeletons.

### Don't:
- **Don't** make it look like a repair-stall flyer: no loud red and yellow, shouting banners, clutter or countdown timers.
- **Don't** drift into the generic startup look: no purple-blue gradients, glass cards, gradient text or rows of identical icon-and-text boxes.
- **Don't** put a coloured stripe on the side of a card or alert, and don't nest cards inside cards.
- **Don't** invent claims (ratings, years trading, warranties, free diagnosis) that have not been confirmed.
- **Don't** add a second typeface, an icon package, or a CSS framework on top of Bootstrap.
