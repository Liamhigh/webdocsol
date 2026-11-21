# Supplementary Archive Assessment

| Document control | Value |
|---|---|
| Status | Proposed assessment; no production capability is enabled |
| Date | 21 November 2026 |
| Base plan | `ARCHIVE-INTEGRATION-PLAN.md` |
| Scope | ContextGem, ContractNLI, OpenContracts, ten further ZIPs, and one bilingual-legislation review |
| Constitutional boundary | Exactly B1–B9; B1–B8 vote; B9 is non-voting and advisory |

## 1. Scope, identity, and method

All thirteen supplementary ZIPs were hashed and checked for unsafe paths, encrypted entries, and symlinks before isolated extraction; none of those container hazards was found. No archive code, installation script, model download, external API call, server, or benchmark was executed. This is a static source review, not a dependency CVE audit, runtime security test, accuracy reproduction, or legal-authority approval.

| Supplied item | Bytes | SHA-256 | Provenance note |
|---|---:|---|---|
| `contextgem-main.zip` | 44,816,450 | `510e0f91d7db4f66fdeed172738497aa46e421a7b1313d2d4fcfbcfa725b78eb` | ContextGem 1.5.1; Apache-2.0 |
| `contract-nli.zip` | 65,362,913 | `e03fc77bbf8b53e2976a250e81d8a294bc3d5e5fb014521e477dee9340d6287b` | Data files match the repository's pinned release byte-for-byte |
| `OpenContracts-main.zip` | 91,726,344 | `42028bf6fca4beccb6d9856bc27f2437453d920d22732652befe6165f7d52e41` | Changelog identifies 3.1.1; no commit identity is inferred from the ZIP |
| `empath-client-master.zip` | 295,668 | `65113012b570aa46e125f1b20fe9f438f5bc7e1c910e1b34009db97d845f1237` | ZIP comment `3f77509adf4e48a5f90aa991e2169ef23a0393dd` |
| `CONTRADOC-main.zip` | 1,353,407 | `2c0e67068466cb525f0ead2c8cf2a3a848f63292a1749595932cd206f5ad3692` | ZIP comment `d1c42d1e433595dd6e98fab7b669722cdc050b1d`; matches the existing pinned evaluation revision |
| `logical-inconsistency-detector-main (2).zip` | 659,430 | `bbafb9f9468e07bdc7379f88ecf33188f72e0da9a2bb8b51670b79d85e63f765` | Different container, but all 16 file payloads match the previously rejected source tree |
| `gaslightingLLM-master.zip` | 4,929,885 | `7d311dc493d85942cffff900c167655544cc36f2be0c781f00b17e959b6d9764` | ZIP comment `4a09069e6bfbbdb1dcb3e1d3df9f3e943bdee55c`; archive-wide licence is unresolved |
| `psyLex-master.zip` | 5,503 | `701e84075c8cd35b2251aa1aa0b3d0771f486828761cabc4db6aeb105466a2c0` | ZIP comment `d3038803fb85b531f619f288964e8b90b16bf54d` |
| `retext-main.zip` | 42,783 | `2f478d8600c58ac0975ac6e343e443940380940a42da669c81819500e9f07fcb` | ZIP comment `04580e54d857f86405c1b109f5205be58f1285f8` |
| `natural-master.zip` | 3,452,507 | `0dcad3910d47d9b6bae6478908a03c643194eff03e028efcf20e53b452f43458` | Natural 8.2.6; ZIP comment `e5bb63d6af741209e71691ae8702e91664d61c29` |
| `afinn-master.zip` | 134,685 | `2d2404ef36332deb1d69a7cf574a2053460baff273b4ad8592fd939e6b4a7c96` | ZIP comment `1d6dfd2b2b8a604eafdd2d175b7a682a0ea0217d` |
| `meyda-main.zip` | 2,473,442 | `2a13ef2878e6543b4460864a7c2119775fc98e4af87de4e983374520c121350a` | ZIP comment `ecf256616d43292c82cbf96e60a91b19ca10eb64`; development manifest, not a fixed release version |
| `wink-nlp-master.zip` | 11,932,082 | `e114ab1a9d9fb654f6da32cfcb09c8f6ec511641267ead8bb7964ba816648d5f` | winkNLP 2.4.0; ZIP comment `c2fa2f1554a64de12dd76421cb6199ded1b6b062` |

The research paper `Emailing information-17-00931.pdf` is 58 pages, SHA-256 `a748e8ad1f8d92d9e2fd1ddf2c4d120077855646e15b7607f2939f2dd401ba62`, DOI `10.3390/info17090931`, and CC BY. It is a conceptual systematic review, not executable code or an admitted jurisdiction pack.

## 2. Admission decisions

| Archive or source | Actual capability and canonical role | Deterministic, evidence, security, and resource boundary | Recommendation |
|---|---|---|---|
| **ContextGem** | LLM/decision-model extraction with typed output, justifications, and text references; optional document conversion and hosted/local models. **B9 research/advisory extraction only.** | Probabilities and model justifications are not deterministic findings or verification. References require exact page/UTF-16 anchors before evidence-preparation use. External models and conversion require explicit egress, artefact, memory, and cost review. | **retain for research** |
| **ContractNLI** | 607 NDAs with 17 fixed hypotheses and `Entailment`/`Contradiction`/`NotMentioned` labels plus evidence spans. Existing B9 development/CI adapter already verifies this release and converts Python code-point spans to UTF-16. | Document-versus-hypothesis NLI is not necessarily a contradiction between two statements in the evidence. Current mapping leaves all hypotheses `not_applicable`, so it measures false positives, not contract-reasoning recall. No production detector or verification seat. | **use only as evaluation oracle** |
| **OpenContracts** | Networked annotation/extraction platform; deterministic citation grammars, exact-slice checks, token/box annotations, and authority-pack preflight are potentially useful to **B7**. Agents, vector search, and LLM extraction remain **B9** research. | Adapt only selected deterministic ideas after MIT/third-party review. Convert Python offsets, rewrite lookbehind grammars, and prove page/UTF-16 mapping. Do not adopt the full stack, external parsers, provider-code loading from packs, demonstration authority content, telemetry defaults, or fail-open/log-sensitive redactor. | **adapt algorithm** |
| **Empath** | Local LIWC-style category counts plus server-generated embedding categories; possible **B4** lexical research. MIT; version 0.089. | Local counts are deterministic but aggregate and unanchored; category membership is not a psychological finding. `create_category` posts to a hard-coded cleartext HTTP backend and must not receive matter data. No network/category-generation lane is admitted. | **retain for research** |
| **ContraDoc** | 449 positive and 442 negative long-document self-contradiction examples created through GPT-4 modification plus human annotation. Existing pinned adapter supplies **B9 evaluation of B1**. Apache-2.0. | Keep development/CI-only and retain separate `verum_exact` and published-comparable metrics. Generation calls OpenAI; the original metric path loads BERTScore. Neither is a production detector or independent review. No duplicate integration is needed. | **use only as evaluation oracle** |
| **Logical Inconsistency Detector `(2)`** | Same Sentence-BERT/K-Means/OpenRouter LLM-judge source as the earlier rejected archives; no licence file. | It deduplicates through unordered sets, truncates input to 500 sentences, filters by similarity, caps judgments at 200, and stops after ten contradictions. This cannot provide complete coverage. Temperature zero does not make hosted judgment independent or deterministic evidence. | **reject** |
| **gaslightingLLM** | DeepCoG attack/safety-alignment research and generated GasConv/SafeConv data; not a forensic gaslighting detector. At most **B9 AI-safety research**. Existing B4 already records bounded reality-denial indicators for human review. | No root/archive-wide licence was established; a nested `llm/LICENSE` does not clear every file or dataset. Sources include external LLM calls, model downloads, `trust_remote_code=True`, and `eval()` of model output. No execution, evidence upload, diagnosis, or finding use. | **retain for research** |
| **psyLex** | MIT-licensed English LIWC-style dictionary reader and deterministic word/category counts using NLTK stemming; possible **B4** research. | No dictionary is supplied, so dictionary rights are separate. English-only stemming, filtering, and counts lose source spans and differ from LIWC. It adds no validated forensic inference and must not label mental state, deception, or abuse. | **retain for research** |
| **retext** | MIT natural-language plugin interface and Latin/Dutch/English concrete-syntax-tree parsing; possible future shared/B4 text preparation. | Parsing is deterministic, but the actual parser and Unified/NLCST dependencies require separate pinning and compatibility review. Stringify/transform plugins must never silently alter evidence text. No admission until position, surrogate-pair, combining-character, cleaned/source, and browser tests prove exact mapping. | **retain for research** |
| **Natural** | Broad MIT NLP library: tokenizers, stemmers, distances, TF-IDF, sentiment, classifiers, tagging, and WordNet. **B4/B9 research only.** | Separate WordNet, stemmer, vocabulary, and dependency terms apply. The broad dependency surface and range-pinning are not justified for small primitives. Deterministic token/distance functions lack Verum anchors; classifiers, sentiment, and TF-IDF rankings cannot create findings. | **retain for research** |
| **AFINN** | Apache-2.0 word-list sentiment scoring in several languages; **B4 contextual research only**. | Arithmetic over a fixed list is deterministic, but lowercasing/whitespace cleaning and word-only output do not preserve anchors. Sentiment scores do not establish sincerity, deception, distress, intent, or a contradiction. Third-party vocabulary provenance and language fixtures remain required. | **retain for research** |
| **Meyda** | MIT browser/Node audio feature extraction: RMS, energy, zero-crossing rate, spectra, MFCC, chroma, loudness, and related measurements. New bounded **B8 observation** candidate. | Use offline, local, default-off extraction over decoded PCM; never alter original audio. Record decoder/version, sample rate, channel, frame/hop/window, numeric precision, and time ranges. Float/decoder variation requires replay tolerances. No tamper, authenticity, speaker, emotion, or intent conclusion follows from a feature. | **adapt algorithm** |
| **winkNLP** | MIT JavaScript NLP with lossless tokenization, sentence/entity spans, deterministic custom-entity patterns, and optional trained models/embeddings. Candidate **B4/shared text-preparation observations**. | Adapt only local deterministic token/custom-pattern behaviour after exact UTF-16 quote tests. Do not run its model-install shell commands during admission; pin and review model artefacts separately. POS/NER/sentiment/embeddings/BM25 remain model or ranking observations, never findings or verification. | **adapt algorithm** |
| **Bilingual-legislation systematic review** | Research on contradictions between equally authoritative language versions, normalization, knowledge graphs, conceptual architecture, and human oversight. **B7/B9 research.** | It supplies no production engine, jurisdiction authority, or validated detector. Any future bilingual B7 pack requires official parallel texts, language-qualified review, version/effective-date identity, aligned anchors, and explicit unresolved divergence states. | **retain for research** |

The base plan's statement that its original twelve archives add no B8 capability remains true for that original scope. Meyda is only a supplementary candidate; it does not complete B8 or authorize media findings. Likewise, OpenContracts demonstration packs are not admitted legal authority, and none of the B4 lexical or sentiment sources weakens the prohibition on psychological, deception, or intent conclusions.

## 3. Existing-repository overlap and non-duplication

- **ContractNLI:** retain `evaluation/contractnli/` and its pinned download/verification path. Do not add a second importer or reinterpret the fixed NDA hypotheses as Verum Omnis pair findings.
- **ContraDoc:** retain `evaluation/contradoc/` at commit `d1c42d1e433595dd6e98fab7b669722cdc050b1d`. The supplied archive adds no new revision or production capability.
- **Logical Inconsistency Detector:** the new container is not byte-identical to the old ZIP, but every contained file is identical. The earlier rejection therefore applies without a new research track.
- **B4:** existing reality-denial/gaslighting-indicator wording already avoids a psychological determination. Generated attack conversations, sentiment, LIWC-style counts, and model labels must not weaken that boundary.
- **B8:** current audio handling seals original bytes and offers separately disclosed transcription. Meyda would be a new observation lane only after NB-1/NB-8 schemas and media-anchor gates; it is not inserted into sealing or transcription code by this plan.

## 4. Supplementary implementation gates

No supplementary archive is implemented by this document. If separately authorized, the only new adaptation spikes justified by this review are:

1. **B7/OpenContracts:** a read-only development comparison of selected deterministic grammar and pack-preflight behaviour against existing `legal-citations.js`/`legal-packs.js`; no platform deployment, external parser, LLM label, authority import, or redactor.
2. **B4/winkNLP:** a default-off, local token/custom-pattern spike over synthetic text; exact source/UTF-16 spans and deterministic ordering are mandatory, with no sentiment, embeddings, NER, or language-model admission.
3. **B8/Meyda:** an offline PCM observation spike after NB-1/NB-8 defines media provenance and time-range anchors; original-byte identity, decoder identity, bounded frames, numeric replay, and explicit non-interpretation are mandatory.

Each spike requires its own exact diff, licence/dependency review, tests, failure accounting, and rollback. None may introduce a production CT type, detector ID, module flag, Findings JSON version, seal/QR/OTS change, external evidence egress, or verification claim without separate approval. The NB-0/NB-1 and VER-1 prerequisites remain unchanged, and none of these projects supplies a Triple Verification seat.
