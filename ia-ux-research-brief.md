# IA/UX Evidence Brief — Desktop Super App (25 pages / 7 domains)

Evidence tags: **[F]** = I fetched the page and quote it directly. **[S]** = search-result/snippet only. **[U]** = could not verify.

---

## 1. Navigation architecture for many-domain apps

**Rule 1.1 — Keep primary nav permanently visible on the left. Never hide 25 destinations behind a hamburger.**
NN/g's quantitative study (179 participants, 6 live sites, desktop + mobile) found hidden navigation was used in **27%** of desktop cases vs **48%** visible and **50%** combo; hidden nav also produced longer task times and higher perceived difficulty, and "hiding navigation degrades the experience and the navigation discoverability more than it does on the phones." NN/g's menu checklist states primary nav for **applications belongs on the left side of the screen**, and "the hamburger menu is not appropriate for desktop websites and apps." [F] https://www.nngroup.com/articles/hamburger-menus/ · https://www.nngroup.com/articles/menu-design/

**Rule 1.2 — Don't chase click depth; chase label quality. The 3-click rule is false.**
NN/g: the rule "has **not** been supported by data in any published studies"; Porter's study showed no dropoff increase past 3 clicks. Chasing it pushes teams to *broad* IAs, which are "more laborious for users to assess" and need lots of UI space. Both very flat and very deep fail. [F] https://www.nngroup.com/articles/3-click-rule/

**Rule 1.3 — Prefer 2-level disclosure with domain hubs over a nested collapse tree.**
Deep hierarchies: "All other things being equal, deep hierarchies are more difficult to use," and with few categories per level, labels become "more generic and, thus, more confusing." Broad menus risk users "overwhelmed by so many links, fail to read the whole list closely, and miss the best option" — mitigated by **visual grouping, not by pushing items into sub-categories**. NN/g recommends "navigation hubs at key points along the way." [F] https://www.nngroup.com/articles/flat-vs-deep-hierarchy/ · 3-click article above

**Rule 1.4 — Copy the VS Code shell: icon rail + secondary panel + secondary panel on the opposite side.**
First-party VS Code docs: an **Activity Bar** switchesthe **Primary Side Bar** (views such as Explorer, Search, Source Control), plus an optional **Secondary Side Bar** "always positioned opposite the Primary Side Bar." VS Code also ships a **layout density** control (Default / Compact) and a movable **Command Palette**. This is the only 20+-destination teardown I verified first-party. [F] https://code.visualstudio.com/docs/configure/custom-layout
Linear / Figma / Notion / Obsidian / Arc / Raycast: I found only search-level or third-party descriptions, not first-party specs — **[U]**. Treat "everyone uses ⌘K" as a *product* observation, not measured evidence.

**Rule 1.5 — Ship ⌘K, but justify it with recognition-over-recall, not with a speed study.**
No controlled study showing palettes beat visible nav was found **[U]**. Recognition beats recall because recall "involves fewer cues" [F] https://www.nngroup.com/articles/recognition-and-recall/ — and NN/g notes users are "bad at" generating query terms from scratch. Palettes solve *expert recall of names*, so they are a **complement** to visible nav, never a replacement.

---

## 2. Psychology — what actually has evidence, and what is myth

| Concept | Actual finding | Verdict / layout consequence |
|---|---|---|
| **Miller 7±2** | Miller (1956): ~7 **chunks** in short-term memory; chunk *size* doesn't matter. NN/g: "It's a common misconception that limited short-term memory implies that menus should be similarly limited to 7 items. It's **fine to have longer menus**… the entire idea of a menu is to rely on recognition rather than recall." [F] https://www.nngroup.com/articles/chunking/ · https://www.nngroup.com/articles/short-term-memory-and-web-usability/ | **MYTH as applied to menus.** Do **not** cap nav at 7. Do cap *simultaneous recall demands* (multi-step forms, cross-panel comparison). |
| **Chunking** | Grouping raises recall and scanability; NN/g recommends **50–75 characters** per line, short paragraphs, headings, and keeping related things close via proximity. [F] same chunking URL | **Keep.** Group the 25 pages into 7 domains; chunk long tables into labelled bands. |
| **Hick–Hyman** | RT grows with log2(number of alternatives). NN/g invokes it only to say very broad top-level IAs are "more laborious to assess." [F] 3-click article | **Keep, narrowly.** It argues against a flat 25-item menu, **not** for truncating to 5 arbitrary items. Group; don't amputate. |
| **Fitts's law** | T = a + b·log2(2D/W); bigger targets are faster with lower error; icon + label enlarges the target; **screen edges are infinite targets — but only for mouse**, not touch (NN/g cites Avrahami). [F] https://www.nngroup.com/articles/fitts-law/ | **Keep.** Full-row-hit targets; 32px+ rows; don't rely on edge-stickiness for a touch-capable build. |
| **Progressive disclosure** | Defers advanced options; improves learnability, efficiency, error rate. NN/g warns: "designs that go beyond 2 disclosure levels typically have low usability." [F] https://www.nngroup.com/articles/progressive-disclosure/ | **Keep, capped at 2 levels.** Rail → panel → page. Advanced agent options live in a secondary sheet, not a third tree level. |
| **Recognition over recall** | Recognition is easier "because it involves more cues." Menus are the classic recognition UI. [F] https://www.nngroup.com/articles/recognition-and-recall/ | **Keep.** Visible nav + breadcrumb + current-location marker + recents. |
| **Information scent (Pirolli & Card)** | Scent = estimated value derived from link label + surrounding context + prior knowledge; vague labels ("More", "Learn more") get ignored. NN/g article fetched; the original Pirolli & Card 1999 *Psychological Review* paper appears at psycnet.apa.org/record/1999-11924-001 **[S]** | **Keep.** Highest-leverage IA lever. Label pages by *task*, not by internal domain name. |
| **Zeigarnik** | A 2025 meta-analysis exists: "Interruption, recall and resumption: a meta-analysis of the Zeigarnik and Ovsiankina effects," *Humanities and Social Sciences Communications* **[S]** — I could not fetch the body. | **Do not use to justify progress bars/gamification.** Contested and heavily reinterpreted; treat as unusable for design. |
| **Von Restorff, serial position, Gestalt similarity, Sweller cognitive load (3 types incl. "germane")** | **Not verified in this pass — [U].** | Do not cite these to stakeholders. Carbon's spacing guidance independently supports proximity ("Elements in a design that are near each other are seen as being meaningfully related… more spacing around them tends to be perceived as higher in importance") [F] https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview |

---

## 3. Hub / home page

- **Overview-first is a visualization mantra, not a general UI law.** Shneiderman, "The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations" (1996) — indexed at https://ieeexplore.ieee.org/document/545307 and https://dl.acm.org/doi/10.5555/832277.834354. The PDF mirror returned `application/pdf` (unreadable to me), so the exact wording is **attributed, not re-verified [U]**. Apply it to *charts*, and be cautious about making it the app's home-page religion.
- **Hub pages must end in an action, not a dead end.** Carbon's empty-state pattern: title, body naming the next action, primary action; "**don't lead the user into a dead end**"; "Don't cover multiple options in one empty state… pick the most important." Empty states must **replace** the element that would show (no column headers behind an empty table) so screen readers don't announce an empty grid. For dashboards with several failing widgets, prefer text-only empty states over repeated illustrations. [F] https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states
- **Hub = 7 domain landing pages**, each showing: (a) the domain's 2–8 pages, (b) a "recents / pinned" block, (c) one primary action. Recents is justified by NN/g's memory model — chunk activation depends on **practice, recency, and context** [F] recognition-and-recall URL — not by a task-resumption study I could verify **[U]**.
- No credible controlled evidence found for "personalized vs curated" hub content or dashboard abandonment rates **[U]** — treat as a hypothesis to test with your own instrumentation.

---

## 4. Density and layout metrics

**Verified numbers:**
- **Carbon spacing scale (px):** 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160 — "multiples of two, four, and eight," with small increments for detail and large ones to "control the density of a design." Don't invent off-scale values. [F] https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview
- **Carbon type scale (px):** 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 54, 60, 68, 76, 84, 92 (y₀ = 12px). Two sets: **productive** ("more condensed treatment… to maintain focus on tasks") for product UI, expressive for editorial. Use productive. [F] https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview
- **Data-table row heights (Carbon):** xs **24**, sm **32**, md **40** (default), lg **48**, xl **64** px; header row must match; xl only for 2-line rows. [F] https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
- **Material 3 type scale (secondary mirror only — verify against m3.material.io, which is JS-rendered):** body-large 16/24, body-medium 14/20, body-small 12/16, label-large 14/20, label-medium 12/16, label-small 11/16, title-medium 16/24 w500. **[S]**
- **Line length:** NN/g "around 50–75 characters." [F] chunking URL
- **Line height:** WCAG 2.2 SC 1.4.12 (AA) requires content to survive line-height **≥1.5×**, paragraph spacing **≥2×**, letter spacing **≥0.12×**, word spacing **≥0.16×** without loss of content or functionality. Your layout must not clip at 1.5×. [F] https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- **Apple HIG macOS metrics** and **Atlassian spacing/density tokens**: pages are JS-rendered and returned empty — **[U]**. Element Plus docs are also JS-rendered; I verified only that **v2.14.6** is current and its four design disciplines (Consistency, Feedback, Efficiency, Controllability) — its default token values are **[U]**. Read them from `element-plus/theme-chalk` source before publishing a spec.

**Concrete recommendation for 1440×900:**
- Spacing scale: **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64**. Component-internal padding 8–12; card padding 16; section gap 24; page gutter 32.
- Type: base **14px/20px**; secondary 12px/16px; page title 24px/32px; section 16px/24px w500–600; tabular numerals on by default.
- Chrome: **icon rail 72px + secondary panel 240–280px** (collapsible to rail-only) → ~1090–1130px content, enough for two 500px table columns side by side.
- Tables: **default 32px rows** for chronology/astronomy data; 40px for primary lists with inline controls. Use 24px only where no interactive cell lives; otherwise inline controls must still meet the 24×24 target rule.
- Prose panels: cap at **~72ch**; tables run full width.

---

## 5. Accessibility in data-dense UIs

- **Contrast:** SC 1.4.3 (AA) — **4.5:1** normal text, **3:1** for large text (≥18pt, or ≥14pt bold; 14pt ≈ 18.5px, 18pt ≈ 24px). Thresholds are hard: "4.499:1 would not meet the 4.5:1 threshold." Disabled controls are exempt. [F] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- **Non-text:** SC 1.4.11 (AA) — **3:1** for the visual information needed to identify UI components, their **states**, and meaningful graphics; this explicitly covers **focus indicators**. Avoid thin low-contrast rules — anti-aliasing makes nominal passes fail in practice. [F] https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- **Focus:** SC 2.4.11 Focus Not Obscured (**AA**) — focused component must not be *entirely* hidden by author content (watch sticky headers/footers). 2.4.12 (AAA) = not hidden at all. 2.4.13 Focus Appearance (**AAA**) — indicator area ≥ a **2 CSS px** perimeter of the unfocused component and **3:1** contrast between focused/unfocused pixels. [F] https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- **Targets:** SC 2.5.8 (AA) — **24×24 CSS px**, with a spacing exception (a 24px-diameter circle per undersized target must not intersect another target). Interactive data-viz density can qualify for the **Essential** exception, but NN/g-style best practice is to also offer a non-dense equivalent. [F] https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **Grids:** use the APG **grid** pattern for interactive tables. Only **one** focusable element in the grid is in the page tab sequence (roving focus); arrows move cell-to-cell, **Home/End** = row ends, **Ctrl+Home/End** = grid ends, **Page Up/Down** = viewport-sized jumps, **Ctrl+Space / Shift+Space** select column/row. For virtualized rows set **`aria-rowcount`/`aria-colcount`** plus `aria-rowindex`/`aria-colindex`. [F] https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- **Color-blind safety:** use the **Okabe & Ito** Color Universal Design palette (2002, rev. 2008) — see "Set of colors that is unambiguous both to colorblinds and non-colorblinds." Verified principles: (1) pick schemes identifiable under all color-vision types; (2) **use shapes/positions/line types/patterns in addition to color** ("redundant coding"); (3) state color names where users communicate about color. Also: avoid red text on dark backgrounds (protanopes see dark red as near-black), avoid red/green pairs, prefer bluish green over yellow-green, label data series directly on the chart rather than in a distant legend. Verified prevalence: ~**1 in 12** Caucasian, **1 in 20** Asian, **1 in 25** African males. [F] https://jfly.uni-koeln.de/color/ · Palette **hex values not present in the fetched page — read them from the linked brochure/PDF [U]**. ColorBrewer and Paul Tol were **not verified this pass [U]**.

---

## Recommended architecture (rationale)

**Persistent 72px icon rail (7 domains) → collapsible secondary panel (that domain's 2–8 pages) → content. Plus ⌘K, breadcrumbs, and a pinned Recents block at the top of the panel.**

Why this and not a flat sidebar of 25 or a nested collapse tree:
1. Primary nav belongs on the left for applications, and hiding it costs ~44% of navigation usage on desktop [F].
2. A rail alone can't carry 25 labelled destinations without becoming an icon-guessing game; a panel alone can't show 25 items without the "long, cluttered menu" failure mode NN/g documents. Splitting the two is exactly the verified VS Code Activity Bar + Primary Side Bar pattern [F].
3. Seven domains keep each panel at **2–8 items**, which is the regime where labels stay specific and scannable — the documented advantage of narrower levels [F].
4. Depth is capped at **2 disclosure levels**, matching NN/g's warning that 3+ levels typically have low usability [F].
5. ⌘K is an accelerator over a *visible* system, so it never becomes the only path (which would re-create the hidden-navigation penalty).

**Open items to resolve before freezing the spec:** Element Plus default tokens, Apple HIG macOS metrics, Atlassian tokens, Okabe–Ito hex values, and the Shneiderman PDF text — all **[U]** above.
