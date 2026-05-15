---
title: "What is an Open Graph image and why does it matter"
slug: what-is-an-open-graph-image
description: "Open Graph images are the preview images that appear when links are shared on LinkedIn, Slack, and X. Here is what they are, how they work, and the right size to use."
published: 2026-05-15
category: guide
cover_alt: "Illustration of a link card showing an Open Graph image preview above a title and description on a white background"
tags: ["open-graph", "og-image", "meta-tags", "social-sharing", "link-preview"]
---

When someone pastes your URL into Slack, shares it on LinkedIn, or tweets a link, a small card appears below the link. It shows a title, a short description, and often a large image. That image is called an Open Graph image, or OG image.

Most people have noticed it. Fewer people know how to control it.

## Where it comes from

The image is not pulled from your page automatically. It comes from a specific HTML meta tag that you (or your CMS) adds to the `<head>` of your page:

```html
<meta property="og:image" content="https://example.com/my-og-image.jpg">
```

That tag tells social platforms and messaging apps which image to use when generating the link preview. If the tag is missing, the platform either shows no image or picks one at random from the page — usually the wrong one.

## What Open Graph actually is

Open Graph is a protocol originally created by Facebook in 2010. It gives web pages a way to describe themselves to social platforms using structured HTML meta tags. The core tags are:

- `og:title` — the title to show in the preview
- `og:description` — the description text
- `og:image` — the preview image
- `og:url` — the canonical URL
- `og:type` — the content type (website, article, product, etc.)

Every major platform reads these tags: LinkedIn, Facebook, X (Twitter), Slack, Discord, WhatsApp, iMessage, and more.

## The right size for an OG image

The recommended size is **1200 x 630 pixels**. This gives you a 1.91:1 aspect ratio that looks correct across all major platforms.

Some practical rules:

- Keep the image under 8 MB (most platforms have a size cap)
- Use JPEG or PNG — both are widely supported
- Put your most important visual content in the center, as some platforms crop the edges on mobile
- Make sure the URL in `og:image` is absolute — it must start with `https://`, not `/`

## Why a missing OG image hurts

When your OG image tag is missing or broken, link previews look sparse. On LinkedIn, a card without an image gets significantly less engagement than one with a strong image. In Slack, the link collapses to just a URL. On X, the card shows as a plain text link rather than a large image card.

For landing pages especially, a well-crafted OG image is worth setting up. Every time someone shares your page — in a team Slack, on LinkedIn, in an email — that preview is your first impression.

## How to check your OG image

Paste your URL into [Get Metadata](https://getmetadata.com/) and you will immediately see:

- Whether your OG image is set
- The full image URL
- The detected pixel dimensions
- Your meta title and description alongside it

No browser extension, no developer tools required. Just paste the URL and check.

## The relationship between og:image and twitter:image

X (Twitter) can read the standard `og:image` tag, but it also supports its own `twitter:image` meta tag. If both are set, Twitter uses `twitter:image`. If only `og:image` is set, Twitter falls back to that.

There is also `twitter:card`, which controls the card style. For a large image preview, set it to `summary_large_image`. Without this, Twitter may show a small thumbnail even if you have an OG image set.

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://example.com/my-og-image.jpg">
```

## Updating your OG image

If you update your OG image and the old one keeps appearing on social platforms, the platform has cached the old data. Most platforms offer a debugger tool to force a refresh:

- **Facebook:** Sharing Debugger
- **LinkedIn:** Post Inspector
- **X:** Card Validator

Paste your URL into the relevant tool, hit Scrape / Refresh, and the cached data clears.
