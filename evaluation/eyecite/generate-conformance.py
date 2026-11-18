#!/usr/bin/env python3
# Development-only spike tooling. Regenerates evaluation/eyecite/conformance.json
# from the PINNED official reference implementation (freelawproject/eyecite,
# BSD-2-Clause). Never part of production analysis; not imported by any browser
# or engine code. Run:
#   pip install eyecite==2.7.8
#   python3 evaluation/eyecite/generate-conformance.py
# The output is committed and reviewed; regenerating must be byte-identical.

import json
import sys

import importlib.metadata

import eyecite
from eyecite import get_citations, resolve_citations

EXPECTED_VERSION = "2.7.8"

TYPE_NAMES = {
    "FullCaseCitation": "full_case",
    "ShortCaseCitation": "short_case",
    "IdCitation": "id",
    "SupraCitation": "supra",
    "FullLawCitation": "full_law",
    "IdLawCitation": "id_law",
    "FullJournalCitation": "full_journal",
    "ReferenceCitation": "reference",
    "UnknownCitation": "unknown",
}

METADATA_KEYS = ["court", "year", "pin_cite", "plaintiff", "defendant", "parenthetical", "extra"]

# Hand-written case texts. Each exercises a listed behavior; the expected
# output is whatever the pinned reference implementation produces, reviewed
# case by case before commit.
CASES = [
    {"id": "full-basic", "behavior": "full case cite, caption, court and year",
     "text": "Foo v. Bar, 123 F.3d 456 (9th Cir. 2020)."},
    {"id": "full-pin-cite", "behavior": "pin cite after the first page",
     "text": "Foo v. Bar, 123 F.3d 456, 459 (9th Cir. 2020)."},
    {"id": "full-parallel", "behavior": "parallel citations share one caption",
     "text": "Foo v. Bar, 123 F.3d 456, 124 F.4th 789 (9th Cir. 2020)."},
    {"id": "full-scotus", "behavior": "U.S. Reports cite implies scotus",
     "text": "Something else, 555 U.S. 100 (2010)."},
    {"id": "short-id", "behavior": "id. short form with pin cite and resolution",
     "text": "Foo v. Bar, 123 F.3d 456 (9th Cir. 2020). Id. at 458."},
    {"id": "short-supra", "behavior": "supra short form with antecedent guess and resolution",
     "text": "Foo v. Bar, 123 F.3d 456 (9th Cir. 2020). Later, Foo, supra, at 459."},
    {"id": "short-id-after-heading", "behavior": "id. following a section heading",
     "text": "Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).\n\nII. Discussion\n\nId. at 458."},
    {"id": "ambiguous-supra", "behavior": "supra antecedent shared by two cases",
     "text": ("Smith v. Alpha, 100 F.3d 200 (1st Cir. 2010). "
              "Smith v. Beta, 300 F.3d 400 (2d Cir. 2015). "
              "See Smith, supra, at 250.")},
    {"id": "unicode-text", "behavior": "non-ASCII text around a cite",
     "text": "Résumé \u00e9lan \u2014 Foo v. Bar, 123 F.3d 456 (9th Cir. 2020) \u2014 na\u00efve \u00fcber."},
    {"id": "line-break-in-cite", "behavior": "newline inside the citation",
     "text": "Foo v. Bar, 123 F.3d\n456 (9th Cir. 2020)."},
    {"id": "hyphenated-caption", "behavior": "hyphenated party names",
     "text": "Smith-Jones v. O'Brien, 789 F. Supp. 2d 100 (S.D.N.Y. 2005)."},
    {"id": "malformed-no-page", "behavior": "volume and reporter without a page",
     "text": "The reference 123 F.3d without more is not a citation."},
    {"id": "malformed-unknown-reporter", "behavior": "reporter string eyecite does not know",
     "text": "See 999 XYZABC 1 (2001) for nothing at all."},
    {"id": "law-statute", "behavior": "U.S. Code statute cite",
     "text": "Under 42 U.S.C. \u00a7 1983 the claim proceeds."},
    {"id": "journal", "behavior": "law journal cite",
     "text": "See Note, 123 Harv. L. Rev. 456 (2010)."},
    {"id": "neutral-za-sa-negative", "behavior": "South African reporter form is not a US cite",
     "text": "The court in 2026 (3) SA 112 (SCA) said nothing of the sort."},
    {"id": "neutral-za-zacc-negative", "behavior": "South African neutral citation is not a US cite",
     "text": "As held in [2026] ZACC 1 at para 12."},
]


def normalize(citation):
    record = {
        "type": TYPE_NAMES.get(type(citation).__name__, type(citation).__name__),
        "span": list(citation.span()),
        "full_span": list(citation.full_span()),
        "matched_text": citation.matched_text(),
        "groups": {k: str(v) for k, v in citation.groups.items()},
        "metadata": {},
    }
    metadata = getattr(citation, "metadata", None)
    if metadata:
        for key in METADATA_KEYS:
            value = getattr(metadata, key, None)
            if value:
                record["metadata"][key] = str(value)
    antecedent = getattr(citation, "antecedent_guess", None)
    if antecedent:
        record["antecedent_guess"] = str(antecedent)
    return record


def main():
    version = importlib.metadata.version("eyecite")
    if version != EXPECTED_VERSION:
        print(f"eyecite {EXPECTED_VERSION} is pinned; found {version}", file=sys.stderr)
        sys.exit(1)
    out_cases = []
    for case in CASES:
        citations = get_citations(case["text"])
        records = [normalize(c) for c in citations]
        clusters = []
        for resource, members in resolve_citations(citations).items():
            cluster = sorted(citations.index(m) for m in members)
            clusters.append(cluster)
        clusters.sort()
        for record in records:
            start, end = record["span"]
            assert case["text"][start:end] == record["matched_text"] or record["type"] in ("id", "supra"), case["id"]
        out_cases.append({
            "id": case["id"],
            "behavior": case["behavior"],
            "text": case["text"],
            "expected": {"citations": records, "clusters": clusters},
        })
    document = {
        "corpus_version": "1.0.0",
        "reference": {
            "name": "eyecite",
            "upstream": "freelawproject/eyecite",
            "version": EXPECTED_VERSION,
            "license": "BSD-2-Clause",
        },
        "note": ("Expected output generated by generate-conformance.py from the pinned official "
                 "eyecite release and reviewed case by case. Offsets are Python string indices "
                 "(Unicode code points); the corpus texts are BMP-only, so they equal UTF-16 "
                 "code-unit offsets for these cases. Span slices are asserted at generation time."),
        "cases": out_cases,
    }
    payload = json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    target = __file__.rsplit("/", 1)[0] + "/conformance.json"
    with open(target, "w", encoding="utf-8") as handle:
        handle.write(payload)
    print(f"wrote {target}: {len(out_cases)} cases")


if __name__ == "__main__":
    main()
