#!/usr/bin/env bash
#
# Re-download the humanitarian standards corpus into ingestion/corpus/.
#
# The PDFs are deliberately NOT committed (see .gitignore). The Sphere Handbook
# is all-rights-reserved — local use for research/training is permitted by its
# copyright page, redistribution is not. This script makes the corpus
# reproducible from the publisher-issued files without redistributing them.
#
# The canonical publisher domains (spherestandards.org,
# interagencystandingcommittee.org) sit behind bot-challenge WAFs that reject
# non-browser HTTP clients, so each entry below points at an official secondary
# mirror of the same publisher-issued PDF (UNHCR Emergency Handbook document
# library, or the CCCM Cluster's S3 resource library). Provenance, canonical
# pages and per-file license terms are recorded in corpus/SOURCES.md.
#
# Usage:
#   ./fetch-corpus.sh          # download anything missing, verify checksums
#   ./fetch-corpus.sh --force  # re-download everything
#   ./fetch-corpus.sh --check  # verify checksums only, download nothing

set -euo pipefail

CORPUS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/corpus"
mkdir -p "$CORPUS_DIR"

FORCE=0
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --check) CHECK_ONLY=1 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# filename|sha256|url
# Checksums are of the files retrieved 2026-08-25; a mismatch means the mirror
# reissued the document (check SOURCES.md and re-verify the license) rather than
# that the download failed.
FILES=(
  "Sphere-Handbook-2018-EN.pdf|eeb7e680c296e15389ca8a1e5882a3796f23cbba31cfb21dd4661332c4c8cf63|https://emergency.unhcr.org/sites/default/files/2024-01/Sphere-Handbook-2018-EN.pdf"
  "CHS-2024.pdf|79419ef5dae4141bc4100245dfa5af9a3d6dcd1b7de9eb142e344b91694b012d|https://emergency.unhcr.org/sites/default/files/2024-01/4.%20The%20Core%20Humanitarian%20Standard%20on%20Quality%20and%20Accountability.pdf"
  "IASC-Data-Responsibility-2023.pdf|662e73bbcf6cac6225cfdec464a477a2961af65edd80e27a64e53fb25d1ad781|https://emergency.unhcr.org/sites/default/files/2023-11/IASC%20Operational%20Guidance%20on%20Data%20Responsibility%20in%20Humanitarian%20Action%2C%202023.pdf"
  "IASC-Protection-Policy-2016.pdf|2a36792d65db64ebc6de82063da51c8177ff24007eb88b22ffbbd208ce456a68|https://emergency.unhcr.org/sites/default/files/2024-01/4.%20IASC%20Policy%20on%20Protection%20in%20Humanitarian%20Action%2C%202016.pdf"
  "IASC-Disability-Inclusion-2019.pdf|bb93dc370a688ca5c81c030674391687c6cf69fcc2a71253ed7301fb84ec3767|https://s3.eu-west-1.amazonaws.com/cccmcluster.org/public/2019-11/iasc_guidelines_on_the_inclusion_of_persons_with_disabilities_in_humanitarian_action_2019.pdf"
  # --- Phase C1 additions (2026-09-01) ---
  "FEWS-NET-Scenario-Development-2018.pdf|56ac6a5c9cc524ea6525e29254c18e9a439fc07c1b310715a89d899ba7bebb4d|https://fews.net/sites/default/files/documents/reports/Guidance_Document_Scenario_Development_2018.pdf"
  "FEWS-NET-Matrix-Analysis-2021.pdf|6402cfa832da12f06559d7aa72c20f3d65d06c8f16626b37d23091541be55afd|https://fews.net/sites/default/files/documents/reports/fews-net-matrix-guidance-document.pdf"
  "WHO-Health-Cluster-Guide-2020.pdf|24caec3d2f2bede3f78ae72d0f3ab64297076d466af5eb091d62797fdd55baa4|https://www.infocop.es/pdf/HealthGuide.pdf"
  "WFP-SCOPE-Brief-2019.pdf|25ae475517a0508723ecef641cfd6c8f1c4f80a000ed9536bd9c100371354cff|https://executiveboard.wfp.org/document_download/WFP-0000001575"
)

# The three data-ecosystem sources below (HDX-docs-2026.md, KoboToolbox-docs-2026.md,
# FEWS-NET-about-2026.md) are NOT fetched by this script: they are hand-compiled
# descriptive summaries of official documentation/about pages that render
# client-side (HDX, Kobo) or sit behind the same UNHCR-family WAF as other
# blocked hosts in this project (see CANDIDATES.md), so no automated re-download
# is possible. They are committed directly to ingestion/corpus/ rather than
# gitignored like the PDFs above -- see SOURCES.md for the pages each summarises
# and the access date.

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    sha256sum "$1" | cut -d' ' -f1
  fi
}

failures=0
for entry in "${FILES[@]}"; do
  IFS='|' read -r name expected url <<< "$entry"
  dest="$CORPUS_DIR/$name"

  if [[ $CHECK_ONLY -eq 0 ]] && { [[ $FORCE -eq 1 ]] || [[ ! -f "$dest" ]]; }; then
    echo "downloading $name"
    # -L follows the mirror's redirects; a browser-ish UA avoids the 403 some
    # CDNs return to bare curl.
    if ! curl -fsSL \
      -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' \
      -o "$dest.part" "$url"; then
      echo "  FAILED: $name could not be downloaded from $url" >&2
      rm -f "$dest.part"
      failures=$((failures + 1))
      continue
    fi
    mv "$dest.part" "$dest"
  fi

  if [[ ! -f "$dest" ]]; then
    echo "  MISSING: $name"
    failures=$((failures + 1))
    continue
  fi

  actual="$(sha256_of "$dest")"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok: $name"
  else
    echo "  CHECKSUM MISMATCH: $name" >&2
    echo "    expected $expected" >&2
    echo "    actual   $actual" >&2
    echo "    the mirror may have reissued this document — re-check its license in corpus/SOURCES.md" >&2
    failures=$((failures + 1))
  fi
done

if [[ $failures -gt 0 ]]; then
  echo "$failures file(s) missing or failed verification" >&2
  exit 1
fi

echo "corpus ready in $CORPUS_DIR"
