# Archive Research Integration, Nine-Brain Restoration and Verification Plan

| Document control | Value |
|---|---|
| Status | Proposed assessment and implementation sequence; no production capability is enabled by this document |
| Date | 21 November 2026 |
| Repository | `liamhigh/webdocsol` |
| Live `main` reviewed | `4f29b9a8076b4f68f66ec3c6bc4754f171dbd80e` |
| Production source baseline | `48836bc7c2f245b00e181d66b539c199d6fcaf2d` |
| Engine / Findings JSON | `5.7.2-web` / `1.11.0` |
| Archive review | Twelve supplied ZIP containers; static inspection only |
| Constitutional boundary | Exactly B1–B9; B1–B8 vote; B9 is non-voting and advisory |

This document records what the supplied research archives can safely contribute to Verum Omnis. It does not adopt a dependency, approve a licence, certify a model, change a detector, authorise a legal conclusion, or describe an unimplemented feature as shipped. The supplied implementation-plan patch contains version 1.3 with Addenda D and E; live `main` still contains version 1.0. Version 1.5 and Addenda F/G were not supplied and are not reconstructed here.

## 1. Review method and verified limits

The review established the following facts:

- The twelve ZIPs contain ten distinct ZIP payloads by SHA-256 and nine distinct source trees after comparing the two Eyecite payloads file by file.
- No unsafe extraction paths, symlinks, or encrypted entries were found. Each archive was extracted into an isolated review directory.
- No supplied archive code, install script, notebook, server, model, or dependency was executed. Archive claims below are therefore static source findings, not runtime validation.
- No real-matter evidence was copied into fixtures or repository content.
- Existing repository tests were run separately from the archives: all 65 Node suites passed, and `npm run check` passed. Browser tests were not run in this review.
- The six inspected production sources are unchanged between the production baseline and live `main`; intervening changes are documentation-only.
- The current report records `independent_verifiers: 1`. Its Thesis/Antithesis/Synthesis structure is one deterministic engine performing three checks, not three independent reviewers.
- `LLM2_*` and `LLM3_*` are narrator-provider lanes. `/api/v1/ai/verify-law` is a legal-citation review path. Neither establishes independent Triple Verification of contradiction findings.
- Existing B7 citation extraction is deterministic and explicitly pack-driven. It produces anchored observations and leaves `findings` empty; it is not authority verification or legal interpretation.

No dependency CVE audit, archive test execution, benchmark reproduction, external-model call, or legal-authoritative review was performed. Absence of a finding in this static review is not a security guarantee.

## 2. Archive identity and duplicate register

| Supplied archive | Bytes | SHA-256 | Relationship |
|---|---:|---|---|
| `Legal-Text-Analytics-main.zip` | 2,852,593 | `d316024162c07bf95c1b83a20fa5b4c4502f3566cd0ce78eb8ceec60ec8099fd` | Unique curated resource tree; ZIP comment identifies `e676fcc3f1f72ccb0d92f069743cea7b990d17b9` |
| `LegalContradictionRAG-main.zip` | 575,125 | `d59fa039ac33ab3d91a7f52c4b1564b1bfe26423a276b9e71fa198ffb73c3dc4` | Unique ContRAG payload |
| `LegalContradictionRAG-main(1).zip` | 575,125 | `d59fa039ac33ab3d91a7f52c4b1564b1bfe26423a276b9e71fa198ffb73c3dc4` | Byte-identical duplicate of `LegalContradictionRAG-main.zip` |
| `awesome-legal-nlp-master.zip` | 9,518 | `149677cfad53fc7377db5b6bddab4c55212d12aa015825a45406e12cd53407af` | Unique catalogue payload |
| `cookbooks-main.zip` | 2,674,566 | `b2f44aa2a43e22e70849c771d502cda3ea9d85cc84b39a5416548d72ab66f940` | Unique Isaacus examples payload |
| `eyecite-main.zip` | 213,057 | `1112dbb3ce47e2242ad44e563fcdd7be92b4a29bd4ef6b19aedfca0e36e41c69` | Eyecite 2.7.8; ZIP comment identifies `b70a146d20f70b366baf150a1cc9e82229ef5a0d` |
| `eyecite-main(1).zip` | 213,409 | `7c5a66028396e3e4f13dcc023e773c9186be2f26338c0afa58d03c21c9297b57` | Different container/metadata, but all 48 source-file payloads match `eyecite-main.zip` |
| `legal-reference-extraction-master.zip` | 365,187 | `2f860f1650bfc32fdef5db8a81c518e2ba445794d0bae89a5dc621975c93b006` | Unique German citation-extraction tree; package version 0.5.5 |
| `lexpredict-lexnlp-master.zip` | 16,757,712 | `5e06c145e8f37079387c043c5f23e5d64ad3399ced4b837a236f2938f2c602fe` | Unique LexNLP tree; source version 2.3.0 |
| `logical-inconsistency-detector-main.zip` | 676,935 | `b4715b3504f5c8c5b1a80a03de6f4d73fd8999f42be887ad9dcf6d144ad36235` | Unique embedding/LLM-judge payload |
| `logical-inconsistency-detector-main(1).zip` | 676,935 | `b4715b3504f5c8c5b1a80a03de6f4d73fd8999f42be887ad9dcf6d144ad36235` | Byte-identical duplicate |
| `policy-contradictions-nlp-main.zip` | 121,294 | `7f835fad42a9ae10430ca28113c51558878fcc15ea12524ccb4bf667eebc21f6` | Unique policy candidate-discovery payload |

A filename containing `main` or `master` is not proof of a current upstream branch or release. Where no commit identity is embedded above, this review does not invent one.

## 3. Archive-by-archive capability and admission decisions

### 3.1 `awesome-legal-nlp-master.zip` — retain for research

- **Actual capability:** a curated catalogue of multilingual legal NLP datasets, models, entailment, retrieval, and evaluation resources. It is not an executable analytics engine. Its README reports a last update of 30 September 2025.
- **Licence/provenance:** MIT for the repository content. Every linked model, dataset, paper, or tool requires separate licence and provenance review.
- **Canonical placement:** B9 research register only. It may help locate later B7 jurisdiction research, but supplies no finding authority.
- **Overlap/new value:** overlaps existing B9 research and evaluation; its new value is source discovery, not detection.
- **Determinism/anchors/privacy/resources:** the catalogue itself performs no analysis. Any selected downstream resource needs its own anchor, offline/replay, privacy, model-size, and resource assessment.
- **Admission tests:** record source URL, retrieved version/commit, licence, dataset jurisdiction/language, intended evaluation use, and any real-data restrictions before using a linked resource.
- **Decision:** **retain for research**. Do not import it as a production component or treat catalogue inclusion as validation.

### 3.2 `Legal-Text-Analytics-main.zip` — retain for research

- **Actual capability:** a curated resource, method, dataset, and tool list rather than executable analytics code. It includes cross-jurisdiction material useful for future legal research.
- **Licence/provenance:** CC BY-SA 4.0 for repository content; linked resources and images have separate terms. The ZIP comment supplies a commit identifier, recorded above.
- **Canonical placement:** B9 research register, with qualified B7 review before any jurisdiction-specific source becomes a legal pack or authority source.
- **Overlap/new value:** overlaps existing research; potentially broadens jurisdiction and method discovery. It does not itself supply a cross-border engine.
- **Determinism/anchors/privacy/resources:** no runtime behaviour to admit. Downstream resources remain unassessed until individually reviewed.
- **Admission tests:** verify source authority, version/effective date, language, permitted use, and whether the material is primary law, secondary commentary, or a research dataset.
- **Decision:** **retain for research**. No production code reuse is proposed.

### 3.3 `legal-reference-extraction-master.zip` — adapt algorithm

- **Actual capability:** version 0.5.5 extracts German statutory and case-law references from plain text, HTML, and Markdown. It preserves raw/canonical span mapping and supports JSONL, BIO, GLiNER, spaCy, W3C Web Annotation, and Akoma Ntoso representations. The base installation has no runtime dependencies; the default extractor combines deterministic regex law/case extractors. Optional CRF/transformer engines are probabilistic.
- **Licence/provenance:** MIT code licence. README claims concerning 271 tests and benchmarks were not executed or independently reproduced.
- **Security:** the transformer default identifies `openlegaldata/legal-reference-extraction-base-de` and sets `trust_remote_code=True`. That default is a production supply-chain blocker. Any future model spike must use reviewed, pinned, hashed local artefacts with `trust_remote_code=False`; no model download is approved here.
- **Canonical placement:** B7 German citation-occurrence pack research. Optional ML output may be a B9 evaluation observation only.
- **Overlap/new value:** overlaps the neutral `legal-citations.js` occurrence core and explicit pack registry. Its potentially new value is German deterministic grammar and raw/cleaned span reconciliation.
- **Determinism/anchors:** adapt only the deterministic regex/span behaviour. Port Python Unicode code-point offsets to JavaScript UTF-16 code-unit offsets; never copy Python offsets directly into `page-text-v1` anchors. Preserve raw text, source page, exact quote, pack/rule identity, deterministic order, and explicit unresolved states.
- **Privacy/resources:** the deterministic lane can be local and bounded. Transformer lanes add download, memory, compute, and external-artefact risks and remain excluded from findings.
- **Admission tests:** synthetic German positive/negative cases; HTML/Markdown raw-to-clean mapping; surrogate pairs and combining characters; exact quote slicing; duplicate/overlap ordering; catastrophic-regex limits; replay; and independent German legal-review sign-off. No production pack ships on translated examples alone.
- **Decision:** **adapt algorithm**, limited to separately reviewed deterministic German extraction. Do not import optional ML or remote-code defaults.

### 3.4 `logical-inconsistency-detector-main.zip` and `(1).zip` — reject

- **Actual capability:** Sentence-BERT embeddings, K-Means clustering, and `gpt-4o-mini` through OpenRouter. It generates candidate pairs and LLM judgments/reports; bundled examples and outputs are experiments, not validated legal findings.
- **Licence/provenance:** no licence file was present. The two supplied ZIPs are byte-identical and receive the same decision.
- **Security/privacy:** `OPENROUTER_API_KEY` is required and document text is sent to an external provider. Requirements are unpinned. No credentials are to be supplied to this research code during admission review.
- **Canonical placement:** no production brain. At most, its published experiment design can inform non-voting B9 negative evaluation.
- **Overlap/new value:** it overlaps candidate discovery but adds no deterministic finding capability. Clustering can omit relevant pairs, and an LLM label cannot prove incompatibility, dishonesty, or intent.
- **Determinism/anchors:** embeddings, clustering, external-model outputs, and generated judgments are not deterministic Verum Omnis findings. Existing sentence text would require complete source anchors before any separate evaluation.
- **Admission tests:** production adoption is not recommended. Any future research-only reproduction would require licence clearance, synthetic/public licensed data, pinned artefacts, no evidence egress, complete candidate-coverage measurement, and separately labelled probabilistic metrics.
- **Decision for both archives:** **reject** production adoption. Do not reuse its LLM judgments as Triple Verification or sealed findings.

### 3.5 `policy-contradictions-nlp-main.zip` — reject

- **Actual capability:** document loading/chunking, transformer embeddings, similar-chunk shortlisting, NLI sentence-pair classification, and human-review CSV output. It is a candidate-discovery pipeline, not a deterministic contradiction engine.
- **Licence/provenance:** no licence file was present. External model downloads and GPU-capable dependencies are required.
- **Security:** the tree contains `.devcontainer/caadmin.netskope.com.cer`; it must not be installed into a trust store automatically. `load_dataset_from_pyspark` interpolates `table_name` into SQL, so untrusted identifiers are unsafe. `load_chunks_pickle` uses unsafe `pickle.load` and also opens the file in text rather than binary mode. Random output suffixes prevent deterministic replay.
- **Canonical placement:** no production brain. The human-review candidate concept may inform B9 evaluation design without copying code.
- **Overlap/new value:** overlaps B1 candidate discovery but cannot replace complete deterministic comparison. Top-k/chunk shortlisting can miss contradictory evidence.
- **Determinism/anchors:** NLI scores and similarity rankings are probabilistic. Any evaluation adaptation must retain document/page/span anchors, full candidate coverage accounting, and deterministic identifiers; random names and pickle persistence are not admitted.
- **Privacy/resources:** model downloads, large document corpora, GPU memory, and possible corporate TLS interception require explicit isolation. No matter evidence may enter this pipeline.
- **Admission tests:** production reuse is rejected. A clean-room evaluation design would require fixed synthetic fixtures, safe JSON schemas, allowlisted data identifiers, no dynamic SQL, complete negative/omission tests, bounded resources, and licence clearance.
- **Decision:** **reject** production adoption.

### 3.6 `LegalContradictionRAG-main.zip` and `(1).zip` — use only as evaluation oracle

- **Actual capability:** ContRAG article-level legal retrieval using FAISS dense retrieval, optional GaMS NLI reranking, Slovenian legal demo data, and SLawNLI pairs. Models download automatically from Hugging Face.
- **Licence/provenance:** no licence file was present. Code, Slovenian legal texts, SLawNLI annotations, models, and adapters need separate provenance/licence clearance. Requirements are unpinned.
- **Security/privacy/resources:** index metadata uses `pickle.load`; untrusted indexes must never be opened. Model downloads and FAISS/GPU resources require pinning, hashing, local isolation, and limits. No matter text is to be sent to hosted services.
- **Canonical placement:** B9 evaluation oracle for retrieval/reranking only. It cannot occupy a verification seat or create B1/B7 findings.
- **Overlap/new value:** overlaps B9 research and may help evaluate whether known legal provisions are retrieved. It does not determine legal meaning, applicable law, or contradiction.
- **Determinism/anchors:** dense scores, top-k retrieval, and NLI labels are probabilistic. Retrieval must never silently replace complete deterministic evidence comparison. Preserve article IDs, source version, exact text spans, index/model identity, and omitted-candidate accounting in any evaluation.
- **Admission tests:** licence/data clearance; safe non-pickle index format; pinned hashed models; deterministic evaluation snapshots; retrieval recall on reviewed queries; NLI false-positive/negative reporting; explicit unavailable/unknown states; and no sealed-finding output.
- **Decision for both archives:** **use only as evaluation oracle**, and only after licence and artefact admission. No production dependency is adopted.

### 3.7 `eyecite-main.zip` and `eyecite-main(1).zip` — use only as evaluation oracle

- **Actual capability:** Eyecite 2.7.8 performs US legal citation extraction, reference resolution, annotation, and cleaning. `get_citations()` is deterministic parser/tokenizer behaviour, not authority verification. `SpanUpdater` supports cleaned/source offset reconciliation.
- **Licence/provenance:** BSD-2-Clause code licence. Dependencies include `courts-db`, `reporters-db`, `lxml`, `regex`, `pyahocorasick`, and `fast-diff-match-patch`. The two containers differ in bytes/metadata but all 48 source-file payloads are identical; they are not two implementations.
- **Canonical placement:** B9/B7 development-time conformance oracle for US citation behaviour. It is not a complete cross-border legal engine.
- **Existing overlap/decision:** repository PR #311 already generated a read-only 17-case corpus against official Python Eyecite 2.7.8 and evaluated two TypeScript ports. Exact case matches were 10/17 and 3/17; divergences included spans, short forms, normalization, and Unicode offsets. Neither port was vendored. The selected route was a narrow neutral parser with conformance fixtures, not a production port dependency.
- **Determinism/anchors:** preserve source spans, cleaned/source mapping, exact raw text, explicit short-form resolution, and deterministic ordering. Python offsets must be converted and tested as UTF-16 code units before entering Verum Omnis anchors.
- **Privacy/resources:** local deterministic evaluation is preferable; no hosted service is needed. Dependency/model/data licences remain distinct from code licence.
- **Admission tests:** continue the existing pinned corpus; add full/short/supra/id., parallel cites, statutes, journals, malformed cites, line breaks, surrogate pairs, combining characters, exact quote slicing, and deliberate-divergence records. A future adapter requires a new admission decision; this document does not reverse PR #311.
- **Decision for both archives:** **use only as evaluation oracle**. Do not directly vendor or claim US authority verification.

### 3.8 `cookbooks-main.zip` — retain for research

- **Actual capability:** Isaacus examples include a legal-document conflict detector, semantic legal citation graph, and tabular review. The conflict detector uses proprietary hosted enrichment, embeddings, classification, reranking, top-k shortlisting, and LLM-generated summaries/recommendations/rewrites.
- **Useful provenance ideas:** source SHA-256, normalized-text SHA-256, model names, pipeline version, cached artefacts, and exact span/quote checks. These ideas can inform evaluation provenance without adopting hosted verdicts.
- **Licence/provenance:** MIT for repository code; third-party sample contracts and external services require separate review.
- **Security/privacy:** the reviewed server binds to loopback and has upload/path/UTF-8 limits, but no authentication or authorization. It must remain a local demo, not a network-exposed production service. Hosted generation/enrichment can disclose document content to external providers. The reviewed CLI subprocess uses an argument list without shell execution, but still sends prompts externally.
- **Canonical placement:** B9 research and evaluation only. It cannot supply B1 contradiction findings, B7 legal conclusions, or independent verification.
- **Determinism/anchors:** hosted scores, fitted formulas, embeddings, `SHORTLIST_MIN_RELEVANCE = 0.5`, and `SHORTLIST_TOP_K = 3` are not deterministic contradiction rules. A shortlist must not suppress complete source comparison.
- **Resource/tests:** evaluate local cache replay, model/version provenance, exact source spans, upload/resource limits, no unauthenticated network exposure, and explicit external-egress consent using synthetic data only.
- **Decision:** **retain for research**. Reuse provenance/evaluation ideas selectively; do not import hosted conflict verdicts or deploy the demo server.

### 3.9 `lexpredict-lexnlp-master.zip` — adapt algorithm

- **Actual capability:** LexNLP 2.3.0 contains deterministic regex/dictionary extractors with source coordinates for acts, citations, courts, amounts, money, percentages, durations, and related entities. It also contains probabilistic classifiers, date parsing, bundled models, and broad legacy dependencies.
- **Licence/provenance:** AGPL-3.0. Licence obligations, including network-use implications, require explicit legal review before copying or deriving production code. No AGPL code is admitted by this document.
- **Security:** bundled models use `joblib.load`/`pickle.load`-family deserialization and must be treated as trusted code, not harmless data. Some parsers have mutable global state requiring concurrency/replay analysis. A training path retrieves spreadsheet-supplied URLs without production SSRF controls and must not run against matter data.
- **Canonical placement:** possible deterministic observation adapters for B5 dates, B6 amounts/money, and B7 acts/citations; B9 evaluation for the rest. No new brain is created.
- **Overlap/new value:** overlaps existing B1/B5/B6/B7 source observations. Selected extractors could broaden normalized entity/date/money preparation, but do not independently establish a contradiction or legal rule.
- **Determinism/anchors:** only selected deterministic regex/dictionary behaviour is a candidate. Preserve exact source spans and quotes, locale, explicit reference time, and ambiguity. A silent `default_currency` must not become unsupported currency attribution. Dateparser relative dates and classifier-enabled output are not purely deterministic rule extraction.
- **Privacy/resources:** prefer small local deterministic adapters. Exclude bundled models, training downloads, broad dependency installation, and external retrieval unless separately approved.
- **Admission tests:** AGPL review; clean-room versus derivative-work decision; deterministic replay/concurrency tests; amount/currency ambiguity; locale/reference-time cases; Unicode UTF-16 conversion; exact anchors; malformed/overflow inputs; bounded regex/resources; and safe JSON persistence.
- **Decision:** **adapt algorithm**, only after AGPL/legal clearance and only for selected deterministic behaviour. Do not reuse the whole package or bundled models directly.

## 4. Canonical nine-brain integration map

The archives strengthen existing brains; they do not create a tenth brain or change canonical numbering.

| Brain | Admissible contribution from this material | Hard boundary |
|---|---|---|
| **B1 — Contradiction Engine** | Evaluation designs for candidate recall, false positives, aligned event/entity pairs, and hard negatives | B1 retains deterministic finding authority. Embeddings, NLI, clustering, retrieval, and LLM judgments may propose/evaluate candidates only; no top-k list may replace complete deterministic comparison |
| **B2 — Document and Image Forensics** | No supplied archive materially adds document/image forensics | Continue redaction-structure, revision, metadata, C2PA, spatial-OCR, and PDF-graph tracks separately. No concealed-content recovery or redaction bypass |
| **B3 — Communications Integrity** | Shared evidence/claim records can later represent messages, actors, and source continuity | None of these archives is a communications-integrity engine. No authorship, intent, or deception inference from text style alone |
| **B4 — Behavioral and Linguistic Patterns** | Research-only linguistic evaluation and human-review workflow ideas | Probabilistic labels remain contextual and non-dispositive; they cannot prove dishonesty, state of mind, or behavioral conclusions |
| **B5 — Timeline and Continuity** | Selected deterministic date/duration extraction after licence and anchor admission; explicit locale/reference time | Allen algebra remains a separate pure deterministic work package. Relative or classifier-based dates are not silently normalized into facts |
| **B6 — Financial Exposure and Transaction Patterns** | Selected deterministic amount/money/percentage extraction with exact spans | Preserve ambiguity and source currency; no silent default currency, unsupported conversion, valuation, or transaction conclusion |
| **B7 — Legal Subject Mapping** | Existing explicit pack core; US Eyecite conformance oracle; possible deterministic German refex adapter; possible selected LexNLP legal-entity extraction after AGPL review | Citation occurrence, authority retrieval, legal interpretation, and contradiction determination remain separate. No automatic governing-law, verdict, or admissibility conclusion |
| **B8 — Audio and Rich Media Forensics** | No supplied archive completes rich-media forensics | Coverage remains explicit and truthful; absent media analysis is a gap, not a pass |
| **B9 — Research and Advisory Mesh** | Catalogues, ContRAG, NLI/LLM evaluations, hosted cookbooks, and research provenance methods | B9 does not vote, issue findings, or occupy a Triple Verification seat. External retrieval and generation remain advisory and separately labelled |

## 5. Triple Verification restoration gate

### 5.1 Required independent records

A future restored verification label requires all of the following over the **same immutable evidence packet and bounded proposition**:

1. The responsible eligible voting brain’s deterministic source/rule review.
2. An independent Mistral review.
3. An independent DeepSeek review.
4. Passing source, context, and independence tests.
5. Separate human adjudication.
6. Grounded narrative and sealed annexes only after the preceding authorizations.

B9 cannot take the brain-side seat. No brain, model, engine, provider, or shared deterministic subroutine may count twice. Neither external model may see or rewrite the other model’s answer before submitting its own. Provider substitution is not silent.

All three technical reviewers must support the same surviving bounded proposition. **Two-of-three agreement is not verification.** Dissent, malformed output, unavailable coverage, provider failure, common-origin duplication, missing context, or absent human adjudication leaves the item `not_verified` or another explicit non-pass state. A model review never edits, removes, reorders, suppresses, or overrules the deterministic finding.

### 5.2 Immutable packet and provenance

Before provider integration, define and test:

- Deterministic packet canonicalization and SHA-512 identity.
- Original evidence-byte identity and unchanged-byte verification.
- Exact page/span/structural/media anchors and verbatim quotes.
- UTF-16 `page-text-v1` offsets, including surrogate-pair and combining-character fixtures.
- Necessary qualifying context, source coverage, extraction route, and known OCR/transcription alternatives.
- Finding ID, detector/rule ID, responsible brain, brain-run ID, engine version, and Constitution version/hash.
- Bounded proposition and existing disposition; no hidden narrative-only resolution.
- Provider, exact model, prompt/configuration identity, response, concise reasons, coverage, and failure state for each review.
- Separate human adjudicator decision/reason and narrative provenance when later authorized.

Do not log secrets or indiscriminately copy evidence into telemetry. Provider packets require data-minimization, retention, region, and egress review.

### 5.3 Implementation order

1. **VER-1 / NB-1:** deterministic shared schemas and immutable packet identity, development-only.
2. **NB-2/NB-5/NB-6 prerequisites:** responsible-brain provenance, finding audit/certification, engagement and concordance context.
3. **VER-2:** isolated provider adapter with no production route and no finding mutation.
4. **VER-3:** responsible-brain plus separate Mistral/DeepSeek review records over identical packets.
5. **VER-4:** separately reviewed bounded endpoint, proposed as `/api/v1/ai/verify-independent`; do not overload existing assess/narrate handlers.
6. **VER-5:** human adjudication and preserved dispositions.
7. **VER-6/VER-7:** grounded narrative, sealed verification/disposition annexes, and rollback only after separate approval.

Calling Mistral and DeepSeek before these gates would create additional opinions, not independent Triple Verification.

## 6. Cross-border legal engine inside B7

### 6.1 Architecture

The cross-border capability is a B7 subsystem, supported by non-voting B9 research. It comprises four deliberately separate lanes:

1. **Occurrence extraction:** deterministic, anchored citation/entity observations from matter-selected packs.
2. **Authority resolution:** explicit source identity, version, effective date, language, and retrieval provenance; unresolved and ambiguous states remain visible.
3. **Legal interpretation:** qualified, versioned legal rules with human review; no inference from citation occurrence alone.
4. **Contradiction/legal-subject mapping:** deterministic findings only under approved Verum Omnis rules and evidence anchors.

Jurisdiction is never inferred from IP address, device region, locale, or language alone. The existing `legal-packs.js` registry and `legal-citations.js` core already enforce explicit pack selection and separate extraction from findings.

### 6.2 Pack admission contract

Each proposed pack must include:

- Explicit jurisdiction and pack IDs, semantic version, implementation digest, and qualified reviewer/status.
- Supported citation kinds and grammar, language/script coverage, known exclusions, and deterministic ordering.
- Primary-authority source provenance, version/effective-date model, retrieval licence/terms, and offline snapshot identity where authorized.
- Raw/page/UTF-16 span anchors and cleaned-to-source mapping.
- Positive, negative, ambiguous, malformed, multilingual, and cross-border conflict fixtures.
- Clear separation of occurrence, resolved authority, legal proposition, and contradiction outcome.

### 6.3 Jurisdiction sequence

1. **Preserve ZA:** keep the existing South African pack isolated and regression-tested.
2. **US evaluation:** retain Eyecite 2.7.8 as the development oracle. Do not reverse the prior TypeScript-port rejection without new measured admission evidence.
3. **German spike:** evaluate only deterministic refex regex/span behaviour under a separate B7 pack PR; exclude transformer/remote-code paths.
4. **Other jurisdictions:** use the catalogues and ContRAG only to discover/evaluate sources. Each new pack needs its own legal, licence, language, anchor, and coverage review.
5. **LexNLP:** treat its configurations as extraction research, not authoritative jurisdiction packs.

No automatic choice-of-law conclusion, legal verdict, admissibility claim, judicial endorsement, or semantic legal-support inference is authorized.

## 7. Consolidated OWASP and privacy review

This is a static review of the supplied paths against OWASP Top 10 (2021), not a penetration test.

| Category | Result and required control |
|---|---|
| **A01 Broken Access Control** | **Finding:** Cookbooks’ demo server has no authentication/authorization. Keep it loopback-only; any production service requires server-side identity, matter-level authorization, and IDOR tests |
| **A02 Cryptographic Failures** | **Finding/limits:** reviewed runtime code uses environment-based API keys rather than obvious embedded keys, and no private-key material was located by the targeted scan. This was not exhaustive secret scanning. External transmission, local caches, and artefact storage remain privacy risks |
| **A03 Injection** | **Finding:** Policy project dynamically interpolates a SQL table identifier. Use fixed allowlisted identifiers if that concept is ever reimplemented. Cookbooks’ reviewed subprocess uses an argument array without `shell=True`; no shell-injection claim is made for that call |
| **A04 Insecure Design** | **Finding:** neural/top-k/LLM workflows cannot serve as deterministic finding or verification designs. Add complete-coverage, fail-closed, independence, human-adjudication, and no-finding-mutation controls |
| **A05 Security Misconfiguration** | **Finding:** refex defaults to `trust_remote_code=True`; automatic model downloads and the policy custom CA require explicit admission. Do not install trust roots, expose demo servers, or enable debug/network paths by default |
| **A06 Vulnerable and Outdated Components** | **Limit/finding:** several projects use unpinned or old dependencies. No dependency installation or CVE audit was performed, so no specific CVE is claimed. Any admitted component requires exact lockfiles, supported versions, dependency scanning, and resource review |
| **A07 Identification and Authentication Failures** | **Finding:** no reusable authentication system was identified; Cookbooks has none. No archive authentication code is accepted for production |
| **A08 Software and Data Integrity Failures** | **Finding:** LexNLP, policy, ContRAG, and refex CRF paths use pickle/joblib-family deserialization. Replace with bounded safe schemas or strictly pinned, hashed, reviewed trusted local artefacts; never open untrusted model/index artefacts |
| **A09 Security Logging and Monitoring Failures** | **Finding:** research/demo projects do not provide Verum Omnis-grade tamper-evident lineage. Integration must add coverage/failure/provenance/replay records without logging secrets or evidence indiscriminately |
| **A10 Server-Side Request Forgery** | **Finding:** LexNLP’s inspected training-time URL retrieval lacks the controls expected for untrusted URLs. If ever adapted, require scheme and destination allowlists, internal-IP/DNS-rebinding defenses, redirect controls, timeouts, and size limits. No broader production SSRF claim is made |

Cross-cutting resource requirements include bounded input bytes/pages/spans, regex timeouts or equivalent complexity controls, memory and concurrency limits, deterministic replay, explicit offline artefacts, no unknown install scripts, and no matter-data egress without separate authorization.

## 8. Gated action plan and PR sequence

Each item is independently reviewable and reversible. A later item does not become authorized merely because an earlier item merges.

| Stage | Scope | Required gate / completion evidence |
|---|---|---|
| **PR 1 — this assessment** | Publish archive identity, decisions, brain mapping, verification and cross-border boundaries | Documentation review only; no production source/schema/seal changes |
| **PR 2 — publish Addenda D/E** | Reconcile and publish the supplied plan v1.3 documentation without inventing v1.5/F/G | Confirm exact diff against then-current `main`; no claim that restoration has shipped |
| **NB-0** | Versioned constitutional decision on concordance rule, agreement unit, and independence | Explicit human governance decision. Until then preview output is `concordance_status: POLICY_UNRESOLVED` |
| **NB-1 / VER-1** | Deterministic shared schemas, packet identity, and a read-only preview over existing findings | Development-only; no new CT/detector ID or production Findings JSON version; canonicalization, anchor, replay, malformed-input, and unchanged-finding tests |
| **NB-2/NB-3** | B1–B8 input views, engagement records, first-pass candidate/support/opposition/exclusion registers | Complete coverage/failure accounting; B9 non-voting; deterministic order; no detector rewrite |
| **NB-4/NB-5/NB-6** | P1–P7 promotion, finding audits, guardian/certification, second pass and concordance | Versioned rules, independent brain contributions, dissent/gaps, audit lineage, and rollback evidence |
| **B7 legal packs** | Separate US oracle maintenance and deterministic German admission spike | Existing Eyecite admission standard; German qualified review; exact UTF-16/raw-clean anchors; no authority conclusion from occurrence |
| **B5/B6 observations** | Selected date/money extractor research after AGPL decision | Licence clearance, deterministic-only subset, ambiguity/reference-time tests, observations-only and default-off |
| **VER-2/VER-3** | Isolated Mistral/DeepSeek adapters and independent review records | Only after packet and responsible-brain gates; identical packets, no cross-talk, full provenance, all-three/fail-closed tests |
| **VER-4/VER-5** | Bounded endpoint and human adjudication/dispositions | Separate route/security review, egress/retention controls, no finding mutation, human decision lineage |
| **NB-7/NB-8/NB-9** | Approved research slices, B8 coverage/findings, report/seal compatibility and annexes | Separate taxonomy/schema/seal approvals; old-seal verification and no silent production-version change |
| **NB-10 / VER-6/VER-7** | Staged rollout, grounded narrative, sealed annexes, rollback | Only authorized anchored material; source-to-sentence coverage; human approval; deployment/rollback rehearsal |

Do not rewrite all detectors in one branch. Do not begin provider endpoints before NB-1/VER-1 and the responsible-brain/context prerequisites exist.

## 9. Test and evaluation requirements

Every admitted deterministic adapter must demonstrate:

- Exact source bytes remain unchanged before and after analysis.
- Exact verbatim quote slicing and complete page/span anchors.
- JavaScript UTF-16 offsets, with surrogate pairs, combining characters, RTL text where relevant, and cleaned/source mapping.
- Stable canonical JSON, deterministic IDs, ordering, and replay across repeated runs.
- Explicit ambiguous/unresolved/failure states and complete coverage accounting.
- No clock, randomness, locale-dependent canonical output, hidden network state, telemetry, or unreviewed model dependency in pure analysis.
- Positive, negative, malformed, boundary, overlap, and adversarial fixtures using synthetic or properly licensed public material.
- Resource limits and clean failure under oversized input, pathological regex, concurrency, and unavailable optional components.
- Registration of new production JavaScript with `npm run check` and new Node suites with `tests/run-all.js`.

Every probabilistic research/evaluation lane must additionally report:

- Exact model/dataset/index/version/hash and licence/provenance.
- Dataset domain, jurisdiction, language, train/test separation, and class balance.
- Candidate-recall/omission measurement, false positives/negatives, and comparison against complete deterministic review where feasible.
- A separately labelled evaluation result; no transfer of a paper’s or project’s benchmark score to Verum Omnis accuracy.
- No sealed-finding output and no independent-verification claim.

Triple Verification tests must include all-three pass, two-of-three rejection, reviewer dissent, provider timeout/failure, malformed response, duplicate/shared-origin reviewer, packet mismatch, Constitution mismatch, missing context, human rejection, and proof that deterministic findings remain byte-for-byte unchanged.

## 10. Decisions and non-goals

This plan recommends:

- Two deterministic algorithm-adaptation tracks: German refex and selected LexNLP behaviour, each still gated by legal/licence/security/anchor review.
- Two evaluation-oracle tracks: Eyecite and ContRAG, subject to their respective admission conditions.
- Research retention for the two catalogues and Cookbooks.
- Rejection of production adoption for the logical-inconsistency and policy-contradiction projects.
- Cross-border expansion inside B7, with B9 research support.
- Independent Triple Verification only after immutable packets, brain provenance, independence, and human-adjudication gates.

This plan does not authorize production dependencies, provider credentials, matter-data egress, new contradiction types, new detector IDs, a production Findings JSON version change, sealing/QR/OTS changes, direct modification of `main`, deployment, or a claim of independent verification. Merging any future PR to `main` requires its own exact-diff review and explicit merge confirmation because the repository deploys through Cloudflare Workers Builds.
