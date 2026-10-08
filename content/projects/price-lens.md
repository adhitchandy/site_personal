---
title: Price Lens
type: software
kind: Software
year: 2026
summary: A research tool that collects listings for the same kind of product from Amazon, eBay, Zalando and MediaMarkt in up to 70 country storefronts and compares the prices in US dollars.
opening: One product, 70 storefronts, prices in US dollars.
lead: A tool for price research
facts: Shops: Amazon, eBay, Zalando, MediaMarkt | Storefronts: Up to 70, by country | Runs: On your own computer | Written in: Python
cover: projects/price-lens-cover.png
poster: a
repo: https://github.com/adhitchandy/price_lens
tone: blue
---
@screens: projects/price-lens
Every study starts in your list of [researches](#1). You [plan](#2) it, the app [collects](#3) the listings, and a long run can be [paused and resumed](#4). You [review](#5) what came back, and the [results](#6) compare every storefront in US dollars. [Storefront health](#7) and the [exchange rates](#8) can be checked along the way.

- **Researches.** Every study sits in one list, with its status, its median price and how widely the prices spread.
- **Plan.** Set the keywords for each language, the target audience, terms to exclude, the price range and the shops to visit. A plan can be written by hand or drafted by AI in a chat.
- **Collect.** The app gathers the listings and shows live progress. A storefront that returned nothing can be retried on its own.
- **Pause and resume.** A long run can be paused and resumed, and it survives a dropped connection or a crash without losing data.
- **Review.** Each listing is marked relevant or not, either by Claude (with an API key) or by hand, and every decision can be overridden.
- **Results.** Findings in plain language, a price chart for each storefront, summaries, and Excel or CSV files to download.
- **Storefront health.** Storefront health is tracked, so shops that have stopped working are easy to spot, and failed connections are retried automatically.
- **Exchange rates.** Prices are converted with the European Central Bank's daily exchange rates, which can be replaced with your own.

Price Lens is a tool for price research: what does the same kind of product cost in different countries, and on different shops? It collects listings from Amazon, eBay, Zalando and MediaMarkt across up to 70 country storefronts, converts the prices to US dollars and writes the comparison to a report with an Excel export.

It runs entirely on your own computer, in the browser at a local address. The research data stays in a folder on the machine and is never uploaded.

It is written in Python 3.10+, with Firefox doing the browsing. The tests run on saved pages and fake scrapers, so they never visit a real shop.

The code and setup instructions for Windows and Mac are on [GitHub](https://github.com/adhitchandy/price_lens).
