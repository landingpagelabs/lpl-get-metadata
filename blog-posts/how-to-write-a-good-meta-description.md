---
title: "How to write a meta description that actually gets clicks"
slug: how-to-write-a-meta-description
description: "Meta descriptions don't directly affect rankings, but they drive click-through rate. Here is how to write one that earns the click."
published: 2026-05-15
category: guide
cover_alt: "Screenshot of a Google search result showing a page title and meta description snippet below"
tags: ["meta-description", "seo", "click-through-rate", "meta-tags", "search-snippets"]
---

Google says meta descriptions are not a ranking factor. That is true. But they are a click-through rate factor, and click-through rate feeds back into how Google thinks about your pages over time.

A good meta description is the one-line pitch between your title and the click. Getting it right is worth the two minutes it takes.

## What is a meta description

A meta description is an HTML meta tag in your page's `<head>` that summarises the page's content:

```html
<meta name="description" content="Your description here.">
```

Search engines display it in results as the snippet of text under your page title. Social platforms also use it as fallback text when no `og:description` is set.

## The length rule

The widely cited guidance is **150 to 160 characters**. Google typically truncates descriptions that run longer than this, ending them with an ellipsis.

Shorter is not automatically better. A 60-character description leaves search real estate on the table. Aim to fill the window with something useful — a description that earns the click — without getting cut off.

Use [Get Metadata](https://getmetadata.com/) to check your current description length against the recommended range. The character bar turns yellow when you are under 150 or over 160, and green when you are within the window.

## What makes a description work

A good description does three things:

**1. Matches the search intent.** If someone searched "how to compress fonts", your description should confirm that your page answers exactly that question. People scan results quickly. If your description does not clearly match what they were looking for, they move to the next result.

**2. Contains the keyword naturally.** Google bolds keywords in descriptions that match the search query. A description with the keyword in plain language stands out visually. Do not stuff it — one natural appearance is enough.

**3. Gives a reason to click.** "Learn more about our service" is not a reason. "Compress any font to WOFF2 in under 30 seconds, free, no signup" is a reason. Specificity drives clicks. Vagueness does not.

## Common mistakes

**Duplicating your H1.** Your title tag often carries the page name. Your description should add something different — context, benefit, a specific detail. Repeating the same words in both wastes the space.

**Writing for Google rather than for the reader.** Descriptions are not read by crawlers — they are read by humans deciding whether to click. Write for that human.

**Leaving it blank.** When no description is set, Google generates one automatically from the page content — usually a snippet that does not represent the page well. Setting your own description takes control of that impression.

**Using the same description on multiple pages.** Duplicate descriptions across a site signal low content quality. Every page with different content should have a distinct description.

## The og:description tag

If you also set the `og:description` meta tag, platforms like LinkedIn and Facebook use that for link previews instead of the standard description. The two can be the same text, or you can write a slightly different version optimised for social sharing rather than search.

```html
<meta name="description" content="Compress any font to WOFF2 in under 30 seconds. Free, no signup required.">
<meta property="og:description" content="Drop any font file and get a compressed WOFF2 in seconds. Free tool from Landing Page Labs.">
```

Both are worth setting. Neither is required for the other to work.

## How to audit your existing descriptions

Paste any URL into [Get Metadata](https://getmetadata.com/) and you will see the meta description alongside its character count and a colour-coded indicator showing whether it falls within the recommended range. If it is missing, you will see a clear warning.

Run your key pages through the tool before publishing, especially landing pages and blog posts where you are actively trying to drive organic traffic. A two-minute check is easier than wondering later why your click-through rate is low.
