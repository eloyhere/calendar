# UX Research Brief — Chinese Calendrics / Astrology / 命理 Desktop App

Target: Electron + Vue 3 + Element Plus. Every claim is tied to a URL. Unverifiable sources are listed at the end and their contents are *not* cited.

---

## 1. Calendar & date-grid patterns

**(a) Density.** NN/g tested Chinese vs. expatriate users across 8 sites: Chinese users *prefer* high density and reject sparse layouts. One participant on a minimalist site: *"while it doesn't have any useless information, it also has less useful information — I can find nothing useful in these simple links."* But the same study found users still failed on genuinely overloaded pages (ICBC: *"The information designed here is not related to us, the normal users. I will never use most of the information here, which makes it too much."*). Density is welcome; **irrelevant** density is not. [nngroup.com](https://www.nngroup.com/articles/china-website-complexity/)

**(b) Overflow / "+N more" is a solved, named pattern.** FullCalendar: *"When a day has more events than fit, show the rest in a popover behind a 'more' link"* — options `dayMaxEventRows` (max stacked levels), `dayMaxEvents` (max events, *not counting* the +more link), `moreLinkClick`, `popoverFormat`. Copy the semantics: cap **rows**, not pixels; make "+N" a real focusable button. [fullcalendar.io/docs/event-popover](https://fullcalendar.io/docs/event-popover) Google Calendar's month view generates exactly this complaint class — thread title *"In the Google calendar 'Month' view, I cannot see all the events after clicking on '13 next'"*; users also filed *"Feature Request: Current Month Only View"*. [thread](https://support.google.com/calendar/thread/106543538/in-the-google-calendar-the-month-view-i-cannot-see-all-the-events-after-clicking-on-13-next?hl=en) · [request](https://support.google.com/calendar/thread/318269334/feature-request-current-month-only-view?hl=en)

**(c) Multi-month beats one cramped month.** FullCalendar ships **Multi-Month Stack** and **Multi-Month Grid** views for exactly this; also tune `fixedWeekCount` (always 6 rows) and `showNonCurrentDates` (greyed adjacent-month days). [stack](https://fullcalendar.io/docs/multimonth-stack) · [grid](https://fullcalendar.io/docs/multimonth-grid) · [month-view](https://fullcalendar.io/docs/month-view)

**(d) Element Plus constraints.** `el-calendar` exposes a `date-cell` scoped slot with `{ date, data: { type, isSelected, day } }` — your hook for multi-calendar cells. But its `range` prop is capped: *"Start time must be Monday, end time must be Sunday, and the time span cannot exceed two months."* It ships only Prev/Next Month + Today; year-jump needs the header slot or `controller-type` (2.13.1+). **For a 12-month or scrolling almanac, `el-calendar` is the wrong primitive** — plan a virtualised custom grid. [element-plus.org](https://element-plus.org/en-US/component/calendar.html)

**(e) Keyboard-first time travel.** Fantastical's shipped set: `⌘T` Go to Today, `⇠/⇢` prev/next **month**, `⇧⇠/⇧⇢` prev/next **day**, `⇧⇡/⇧⇣` prev/next **week**, `⌘F` search, `⌘⇣` jump from search field to first result, `⌘E` toggle details. Note the deliberate asymmetry: bare arrows = month, shifted = day/week. [flexibits.com](https://flexibits.com/fantastical/help/keyboard-shortcuts)

**Why cells truncate.** Apple's floor is *"controls that measure at least 44 points x 44 points"* and *"Text should be at least 11 points"* — a 6-row grid at 44pt/row already needs ≥264pt of pure cell height, before any 农历/干支/节气 sub-lines. [developer.apple.com/design/tips](https://developer.apple.com/design/tips/) For birth-date entry, SubUX summarises NN/g: *"well-labeled text inputs outperform calendar widgets for known specific dates"* — offer a typed field, picker secondary. [subux.pro](https://subux.pro/glossary/date-picker)

---

## 2. Astrology / astronomy UI

**The #1 documented failure is the dense default wheel.** A Chinese learner: *"行星、星座、宫位挤在一起，红色的线条代表刑相，蓝色的线条代表三分相，我盯着那些密密麻麻的符号和线条，完全不知道该怎么对应资料里的知识点."* She was defeated by settings vocabulary (*"House System" "Aspect Orbs"*), *"最后只能退回到初始页面，对着默认的星盘图发呆"*, and took **until 1 a.m.** to work out how to hide minor aspect lines. [xpan360.com](http://www.xpan360.com/article/how_did_i_become_an_astrologer)

**Counter-patterns, all shipped in Solar Fire** (reviewed by Hank Friedman):
- **Orb → line weight.** Linear, square-root, square-root-squared, *partile only*, or explicit thickness per degree of orb. Tighter orb = thicker line.
- **Applying vs. separating**: separating aspects render as **dotted lines** — a second semantic channel from stroke style alone.
- **Filtering**: only trines, only a harmonic family, only applying/separating, only aspects to one point, only a named pattern (T-Square → Kite → Star of David), or only within an orb %. Filtering auto-disables on window close.
- **Hover preview in lists**: moving down a chart file previews each chart, including saved-state and attached events.
- **Tropical ↔ Sidereal** one-click; Vedic defaults to Lahiri ayanamsha.
- **Graphic ephemeris** cursor reads out *date + zodiacal degree*, scrubbable both ways.

[solarfireastrology.com](https://www.solarfireastrology.com/solarfiredeluxe.htm)

**Planet tables.** Astro.com's "Current Planets" is a plain table — body, degree, minutes, seconds, an `r` suffix for retrograde, and declination (`Venus 6 32'22"r 20s49`). Note retrograde is a **textual suffix**, not only a glyph. [astro.com/pl_e.htm](https://www.astro.com/pl_e.htm)

**Glyph rendering is a real production risk.** Astro.com maintains a FAQ because users see *"letters instead of astrological symbols for Mars or Aries (in this case E and a)"* when the `adienst1` web font fails; they ship the `.ttf` for manual install. If your wheel uses private-use-area glyphs, ship an SVG sprite or bundled webfont fallback plus text labels. [astro.com glyph FAQ](https://www.astro.com/cgi/xa.cgi/faq/fq_tech_glyphs_e.htm)

**Worth copying:** Astro.com's **AstroClick Portrait** makes the wheel itself clickable — click a planet or aspect line and the interpretation appears in place. [astro.com](https://www.astro.com/cgi/aclch.cgi?btyp=ack)

---

## 3. Chinese metaphysics (命理/数术) 排盘 apps

**The standard 四柱 layout, per a working practitioner.** Failure mode, verbatim: *"年月日时四个柱子挤成一团，天干地支黏在一起，大运流年更是找不着影."* Their "complete 盘" spec:

- **Orientation:** traditional is **vertical (竖排), right-to-left**, 年 → 月 → 日 → 时. Horizontal is fine *"但一定要对齐"* — stems and branches must align column-for-column.
- **日主 is the anchor**: traditionally a red dot under the day stem, or an explicit 日主 label.
- **十神 sits beside each 干/支**, not in a separate table.
- **大运: eight steps × ten years**, each labelled with **start age + Gregorian year** so 流年 maps straight on; 起运 precise to the month (*"出生后X年X个月起运"*).
- **流年 under 大运**, formatted `2024年 甲辰 七杀`.
- **神煞 selective**: keep 天乙贵人/驿马/桃花/华盖, drop the rest, *"免得盘面太乱"*. But **空亡 (日空/年空) must always show.**
- Plus 地支藏干, 性别, and explicit 公历/农历 labelling.

[tianyu028.com/sz/6264.html](https://www.tianyu028.com/sz/6264.html)

**App-by-app, from a 6-month hands-on:** **元亨利贞** — *"大运流年排得很清楚"*, 神煞 complete, intuitive 大运走势图; but 真太阳时 hard to adjust and *"算法跟传统子平法有点出入"*. **问真八字** — *"界面做得确实舒服，排盘速度快，交互也顺滑"*, 八字盘↔六爻盘 switching; but 大运流年 paywalled, 神煞起法偏现代. **八字排盘宝** — *"界面土得掉渣，但功能是真硬核"* (custom 起运时间, 节气切换精确度, 胎元, 命宫); *"操作有点反人类，新手第一次打开可能一脸懵"*. **易学之家** — 子平/盲派/新派 switching, huge 神煞库, but *"神煞太多也眼花，容易抓不住重点"* and popup ads. [tianyu028.com/sz/6922.html](https://www.tianyu028.com/sz/6922.html)

**紫微斗数:** 文墨天机 wins on *"大限和流年的交互，看着舒服"* and *"命盘画得像手绘的，读起来不费眼"*; but terminology is opaque to beginners. 问真紫薇 wins on **plain language** (*"容易情绪低落"* not *"太阴落陷在疾厄"*) plus customisable 大限起运时间 and 星曜亮度. 灵机文化 has the best visuals and a large **命例/名人案例库** but *"程式化"* AI readings. 测测 does 合盘 conveniently but *"宫位系统有时候会出错，大限的推演也不是特别严谨"*. [tianyu028.com/sz/415.html](https://www.tianyu028.com/sz/415.html)

**Desktop↔mobile parity is expected.** 星侨 added 「十二時辰檢索」 to mobile after *"有客戶建議手機版 app 中，是否可以加入電腦版的「十二時辰檢索」"*. [nccsoft.com/?p=6284](https://nccsoft.com/?p=6284) For traditional 十二宫 placement, the Qing *紫微斗數全書* lays 命/身 out as a fixed table keyed to birth month/hour (三月亥時安命 / 三月辰時安身). [shidianguji.com](https://www.shidianguji.com/book/SDZJ0170/chapter/1jvzooy7dkbhh)

---

## 4. Almanac pain points — surface, don't hide

Every ambiguity below has a **concrete numeric consequence**, so the UI can show the computation rather than assert a result.

**真太阳时.** Longitude costs **4 min/degree**. Ürümqi (87.6°E) is 32.4° from 120°E → **129 min 36 s**; a 10:00 Beijing-time birth becomes **07:50:24 → 辰时, not 巳时**, hour pillar 己巳→戊辰. Most software *"默认使用北京时间排盘，未自动校准出生地经度差异"*. Surface: `北京时间 10:00 → 真太阳时 07:50:24 (−2h09m36s) → 辰时`.

**节气 boundary.** 月柱 follows the *solar-term instant*, never 农历正月初一. 2024 立春 = **2024-02-04 16:26:53** Beijing; at Lhasa (91.1°E) that is **14:31:17** true solar. A birth at 16:25 → still 丑月; at 16:28 → **寅月**.

**闰月.** 2023's 闰二月 is still **卯**, not 辰 — *"月支与原月份一致，仅在记录时标注闰月"*. Render it as a flag on the month, never a 13th month.

**早子时/晚子时.** Genuinely contested: some software splits the day pillar at **23:00**, others at **00:00**. Make it an explicit labelled toggle and show which rule produced the chart.

**DST.** China ran DST **1986–1991** (mid-April→mid-September); software that skips it gets wrong hour pillars. Subtract 1 h *before* the longitude correction, and show it.

[all four: 9sm.cn/wz-25940.html](https://m.9sm.cn/wz-25940.html)

**Real symptom + real quote.** Honor MagicOS calendar (v19.0.10.301): *"准备记录好友生日时，选择农历生日记录，发现选择的日期必须大于实际的日期，如选择廿三，实际是十三"* — off by **ten days**. The official reply was "restart / clear cache" — the ambiguity hidden, then hand-waved. Design against exactly this. [club-api.c.hihonor.com](https://club-api.c.hihonor.com/thread-29883890-1-1.html) Comparable older review: *"农历与公历日期换算在某年差一天"*. [appchina.com](https://www.appchina.com/app/cn.bluecrane.calendar/comments_4.html)

**App disagreement is itself the pain.** A shared post documents a calendar saying 腊月初九 while the phone's built-in lunar calendar said 腊月初七, with 紫金山天文台 confirming the 29th — *"日历都能打架"*. [toutiao.com](https://m.toutiao.com/w/1855502665048455/)

---

## What to copy

1. **A computation-transparency panel** beside every chart: 北京时间 / 经度 / 真太阳时偏移 / 转换后时辰 / 节气时刻 / 边界距离 / DST 扣除 / 子时规则. ([9sm.cn](https://m.9sm.cn/wz-25940.html))
2. **Orb→line-weight + dotted separating aspects**, with "hide minor aspects" **on by default**. ([Solar Fire](https://www.solarfireastrology.com/solarfiredeluxe.htm), [xpan360](http://www.xpan360.com/article/how_did_i_become_an_astrologer))
3. **Cap rows, not pixels**; make "+N" a real focusable button opening a popover. ([FullCalendar](https://fullcalendar.io/docs/event-popover))
4. **Fantastical's shortcut grammar**: `⌘T` today, bare arrows = month, `⇧`+arrows = day/week, `⌘⇣` = field→first result. ([Flexibits](https://flexibits.com/fantastical/help/keyboard-shortcuts))
5. **日主 visually anchored** (red dot/label); 大运 steps labelled with **start age + Gregorian year**. ([tianyu028](https://www.tianyu028.com/sz/6264.html))
6. **A clickable wheel** — the chart is the navigation, not a picture. ([astro.com](https://www.astro.com/cgi/aclch.cgi?btyp=ack))
7. **A plain-language layer**, as 问真紫薇 did. ([tianyu028](https://www.tianyu028.com/sz/415.html))

## What to avoid

1. **Don't use `el-calendar` for the main almanac grid** — `range` is capped at two months, Monday→Sunday. ([Element Plus](https://element-plus.org/en-US/component/calendar.html))
2. **Don't render 神煞 exhaustively** — *"神煞太多也眼花，容易抓不住重点"*. Always keep 空亡. ([tianyu028](https://www.tianyu028.com/sz/6264.html), [tianyu028](https://www.tianyu028.com/sz/6922.html))
3. **Don't expose "House System"/"Aspect Orbs" as unlabelled jargon.** ([xpan360](http://www.xpan360.com/article/how_did_i_become_an_astrologer))
4. **Don't rely on a bare glyph webfont** with no fallback. ([astro.com](https://www.astro.com/cgi/xa.cgi/faq/fq_tech_glyphs_e.htm))
5. **Don't hide 早子时/晚子时, 闰月, or DST behind a silent default.** ([9sm.cn](https://m.9sm.cn/wz-25940.html))
6. **Don't answer an almanac bug with "clear cache."** ([hihonor](https://club-api.c.hihonor.com/thread-29883890-1-1.html))
7. **Don't chase minimalism for this audience.** ([nngroup](https://www.nngroup.com/articles/china-website-complexity/))

## Unverified — contents NOT cited above

`nngroup.com/articles/date-input/` (fetch failed); `ixd.prattsi.org` Co-Star critiques (body truncated); `zhuanlan.zhihu.com/p/2078124405218136921` (403, title only: "同一个生日，6个App算出3种'你'"); `pmo.cas.cn` 2025 历书 PDF (binary rejected); Google Calendar thread bodies (fetch failed — only **titles** quoted); app-store **rating numbers** for TimePassages / The Pattern / Notion Calendar (inconsistent across locales, omitted).
