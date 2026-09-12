# ExploreYC World — Product Hunt launch plan

Written 2026-09-12. Numbers are live production values, not estimates.

| | |
|---|---|
| Companies in the database | **28,368** |
| Companies already on the globe | **5,591** |
| Paid plots today | **0** |
| Visitors, last 30 days | **2,329** (7,650 pageviews) |
| Countries those visitors came from | **95** |
| Previous PH result | **#1 Product of the Day**, 567 upvotes |

Traffic figures are Vercel Web Analytics for exploreyc.com, read live on
2026-09-12. They are the strongest number you own — use them.

---

## 1. The decision that shapes everything

**You have already won Product Hunt once.** You cannot relaunch the same
product — but you can launch a genuinely new one, and ExploreYC World is a
separate product with its own URL, its own pricing and its own mechanic.

That gives you an advantage most launches do not have: **your existing PH
followers get notified the moment you post.** Those 567 upvoters are a warm
list you did not have the first time. Do not waste it on a soft launch.

Launch as **ExploreYC World**, not as "ExploreYC 2.0". Link it to the original
in the first comment so the credibility transfers without looking like a
relaunch.

---

## 2. Blockers — do not launch until these are cleared

### 2.1 The globe is empty. This is the launch-killer.

Zero paid plots means a visitor arriving from Product Hunt sees an empty map
and concludes the product is dead. On PH the first hour decides the day, and
nothing kills momentum like an abandoned-looking page.

**Fix it before you post.** Get 15–30 real startups onto the globe first:

- Ask founders you know to claim their country for $5. Most will, for the
  novelty, if you ask personally and send them the direct link.
- Offer the first 20 a comp if they will use a real logo and a real URL. A
  real company with a free plot is honest; a fake company is not.
- Spread them across continents so the globe looks inhabited from any angle —
  a visitor in Brazil should not see a blank hemisphere.
- Seed at least three countries with **competing** bids, because the bidding
  list is the mechanic. One plot per country demonstrates nothing.

Target state at launch: **every populated continent has a logo, and at least
three countries show a contest.**

### 2.2 Nobody has ever paid you

The live Stripe checkout has never processed a real transaction. Run one $5
purchase yourself, end to end, and confirm the plot appears on the globe. If
the webhook is broken you will find out on launch day, at the worst possible
moment, with traffic you cannot get back.

### 2.3 Decide the tax position

Stripe Tax is not enabled. You are a Bulgarian company selling to consumers
worldwide. Decide deliberately before money arrives at volume — retrofitting
VAT after a few hundred sales is materially harder than switching it on now.

---

## 3. Positioning

The weak pitch is "advertising space on a globe" — that sounds like something
to sell, and Product Hunt does not upvote things that want its money.

The strong pitch leads with the free thing and lets the paid thing be the
twist:

> We mapped 28,368 startups. Now you can own a spot on it.

This works because it is **two products in one post**: a genuinely free,
open-source dataset that a developer can use today, and a $5 novelty that is
funny enough to share. The first earns the upvote; the second earns the
revenue. A maker who only ships the second gets called out; a maker who ships
both gets applauded.

**Lean on national pride.** "Bulgaria is #14" is a better share driver than any
feature. People fight for their country in a way they never fight for
themselves. Your country boards are the viral surface — make sure your launch
copy points at them.

---

## 4. Copy

### Name (40 char limit)
```
ExploreYC World
```

### Tagline (60 char limit) — pick one
```
28,368 startups mapped. Claim your country for $5.
```
```
Put your startup on the world map — from $5
```
```
The startup world map. Stake your country, take #1.
```

The first is strongest: it leads with the free asset, states the price, and the
number does the credibility work.

### Description (260 char limit)
```
A live 3D globe of 28,368 startups from YC, a16z, Product Hunt and Hacker
News — free and open source. Claim your startup's spot for $5, put your logo
on it, and climb your country's board. No prize, no payout. Just the map.
```

### First comment (the one that matters)

Post it within 60 seconds of going live. Keep it personal, admit the
commercial motive plainly — PH punishes coyness far harder than it punishes
selling.

```
Hey Product Hunt 👋

Last year I launched ExploreYC here and you made it #1 Product of the Day.
It's a free, open-source API over 28,368 startups from YC, a16z, Product
Hunt and Hacker News. It's still free, still open source, and it's how a lot
of people build their startup research tools.

Running it costs money. So I built the thing I actually wanted to see:

🌍 Every one of those startups is on a 3D globe.
📍 Yours can own a spot on it for $5.
🏆 Every dollar scores for your country — world, country and city boards.

For context on what $5 buys: 2,329 people visited exploreyc.com in the last
30 days, from 95 countries. Your logo sits on the globe they land on.

Bulgaria is #14 right now. That's embarrassing, and it's the whole game.

To be straight with you: this is how I monetise the free tool. No prize, no
payout, no refund — you're buying a pin on a map and a place on a board,
nothing more. The API stays free forever.

The globe: exploreyc.com/world
The free API: exploreyc.com/api-docs
The code: github.com/KonstantinMB/exploreyc

Ask me anything — I'll be here all day.
```

### Gallery — 5 assets, in this order

1. **A GIF of the globe rotating with real logos on it.** This is the whole
   product. Make it the thumbnail. 3–5 seconds, looping, no text overlay.
2. **A country panel with a real contest** — several startups bidding, #1
   crowned. This shows the mechanic in one frame.
3. **The stake modal** — two fields and a price. Shows how little friction
   there is.
4. **The leaderboard** — countries ranked. This is the share hook.
5. **The free API / database** — proves the open-source half is real.

Do not put a screenshot of a pricing table in the gallery. Nothing depresses a
PH gallery faster.

---

## 5. Timing

- **Day:** Tuesday or Wednesday. Avoid Monday (crowded) and Friday–Sunday
  (low traffic, and your product needs people who are at a desk).
- **Time:** 00:01 PT. The PH day is 24 hours from midnight Pacific; posting
  later just donates hours to your competition.
- **Bulgaria is UTC+3**, so 00:01 PT is **10:01 EEST**. That is a civilised
  hour — you will be awake and responsive for the whole first half of the day,
  which is when it is decided.

---

## 6. Launch-day playbook

**T-48h**
- Seed the globe (section 2.1). This is the highest-leverage hour you will
  spend.
- Run the live $5 purchase.
- Prepare the GIF. A weak thumbnail costs more upvotes than any copy choice.
- Line up 20–30 people who will genuinely look in the first two hours. Do not
  ask for upvotes in writing — PH detects and penalises solicitation. Ask them
  to "take a look and tell me what you think."

**T-0 → T+2h** (the hours that decide the day)
- Post the first comment immediately.
- Reply to every comment within minutes. Comment velocity is ranking signal
  and it is the one lever you fully control.
- Post to X, LinkedIn and relevant Slack/Discord communities — link the
  **globe**, not the PH page, from anywhere that penalises PH links.

**T+2h → T+12h**
- Watch for national angles. If a country climbs, say so publicly: "🇧🇬
  Bulgaria just took #9." That is the loop — each country's founders recruit
  their own.
- Post one mid-day update to the PH thread with a real number.

**T+24h**
- Publish the result honestly, win or lose. "We ranked #N and sold X plots"
  is content, and it is the beginning of the next launch.

---

## 7. The metric to watch

Not upvotes. **Plots sold in the first 24 hours.** Upvotes are vanity on a
product whose whole premise is that people will pay $5. If you rank #3 and
sell 200 plots, that is a success. If you rank #1 and sell 4, the product has
a positioning problem and you want to know that immediately.

---

## 8. Honest risks

| Risk | Mitigation |
|---|---|
| Empty globe on arrival | Seed 15–30 real startups first (§2.1). Non-negotiable. |
| "This is just an ad buy" backlash | Say it plainly yourself, first, in the first comment. The free API is the defence and it is genuine. |
| Payment fails under load | Test live first. The webhook is the single point of failure. |
| Gambling comparison | The honesty strings already say no prize / no payout / no refund. Keep them visible; never describe it as betting or odds. |
| Traffic spike knocks the backend over | Railway autoscaling and DB connection limits are untested at launch volume. Worth a load check before the day. |
