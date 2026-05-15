#!/usr/bin/env python3
"""Build the blog/ directory from blog-posts/*.md."""
import json
import sys
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blog_build import build_site  # noqa: E402

if __name__ == "__main__":
    result = build_site(SITE_ROOT)
    print(json.dumps(result, indent=2))
