# trim_sample.py
# Makes the small saved SEC files the tests use. The SEC's full files are
# 4-5 MB per company; this keeps only the tags the parser reads and filings
# from 2021 on (enough for 3-year growth).
#
# Usage: python trim_sample.py <folder with raw files> <CIK> [<CIK> ...]
# where the folder holds facts_<CIK>.json and sub_<CIK>.json downloaded from
#   https://data.sec.gov/api/xbrl/companyfacts/CIK<CIK>.json
#   https://data.sec.gov/submissions/CIK<CIK>.json

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))

from companydata.xbrl import ALL_TAGS, COVER_SHARES_TAG  # noqa: E402

SINCE = "2021-01-01"
KEEP_FORMS = {"10-K", "10-Q", "10-K/A", "10-Q/A", "20-F", "40-F", "8-K"}
SUBMISSION_KEYS = ["cik", "name", "tickers", "exchanges", "sic", "sicDescription", "fiscalYearEnd", "category"]


def trim_facts(data):
    keep = {"us-gaap": set(ALL_TAGS), "dei": {COVER_SHARES_TAG}}
    facts = {}
    for taxonomy, tags in keep.items():
        for tag, body in data["facts"].get(taxonomy, {}).items():
            if tag not in tags:
                continue
            units = {unit: [f for f in rows if f.get("filed", "") >= SINCE] for unit, rows in body["units"].items()}
            facts.setdefault(taxonomy, {})[tag] = {"label": body.get("label"), "units": units}
    return {"cik": data["cik"], "entityName": data["entityName"], "facts": facts}


def trim_submissions(data):
    recent = data["filings"]["recent"]
    rows = [i for i, form in enumerate(recent["form"]) if form in KEEP_FORMS and recent["filingDate"][i] >= SINCE]
    columns = ["accessionNumber", "filingDate", "reportDate", "form", "primaryDocument"]
    trimmed = {key: data[key] for key in SUBMISSION_KEYS if key in data}
    trimmed["filings"] = {"recent": {col: [recent[col][i] for i in rows] for col in columns}, "files": []}
    return trimmed


if __name__ == "__main__":
    source, ciks = sys.argv[1], sys.argv[2:]
    for cik in ciks:
        with open(os.path.join(source, f"facts_{cik}.json")) as f:
            facts = trim_facts(json.load(f))
        with open(os.path.join(source, f"sub_{cik}.json")) as f:
            submissions = trim_submissions(json.load(f))
        for name, body in (("companyfacts", facts), ("submissions", submissions)):
            with open(os.path.join(HERE, f"{name}_{cik}.json"), "w") as f:
                json.dump(body, f, separators=(",", ":"))
