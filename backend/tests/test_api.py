# The API endpoints, with an in-memory stand-in for the database.
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import database
import main
from legacy_cases import CASE_2
from model.legacy import legacy_to_v2


class FakeDatabase:
    def __init__(self):
        self.rows = {}
        self.next_id = 1

    def add(self, name, inputs, results, model_version=2, currency="USD"):
        row = {"id": self.next_id, "name": name, "inputs": inputs, "results": results,
               "model_version": model_version, "currency": currency,
               "created_at": datetime.now(timezone.utc)}
        self.rows[self.next_id] = row
        self.next_id += 1
        return row

    def list(self):
        return [{k: r[k] for k in ("id", "name", "currency", "created_at")} for r in self.rows.values()]


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeDatabase()
    monkeypatch.setattr(database, "save_deal", db.add)
    monkeypatch.setattr(database, "list_deals", db.list)
    monkeypatch.setattr(database, "get_deal", lambda i: db.rows.get(i))
    monkeypatch.setattr(database, "delete_deal", lambda i: db.rows.pop(i, None) is not None)
    return db


client = TestClient(main.app)
NEW_FORMAT = legacy_to_v2(CASE_2).model_dump()


def test_calculate_accepts_the_old_format():
    response = client.post("/calculate", json=CASE_2)
    assert response.status_code == 200
    assert round(response.json()["years"][2]["gaap_accretion"] * 100, 1) == 18.3


def test_calculate_accepts_the_new_format():
    response = client.post("/calculate", json=NEW_FORMAT)
    assert response.status_code == 200
    assert round(response.json()["years"][0]["gaap_accretion"] * 100, 1) == -3.0


def test_bad_inputs_give_readable_errors():
    bad = {**NEW_FORMAT, "acquirer": {**NEW_FORMAT["acquirer"], "share_price": 0}}
    response = client.post("/calculate", json=bad)
    assert response.status_code == 422
    assert "acquirer.share_price" in response.json()["detail"]

    wrong_mix = {**CASE_2, "pct_cash": 0.3}
    response = client.post("/calculate", json=wrong_mix)
    assert response.status_code == 400
    assert "Payment mix must add up to 100%" in response.json()["detail"]


def test_sensitivity_with_axes():
    response = client.post("/sensitivity", json={"inputs": NEW_FORMAT, "x_axis": "pct_stock", "y_axis": "debt_rate"})
    assert response.status_code == 200
    grid = response.json()
    assert grid["x_axis"]["key"] == "pct_stock"
    assert len(grid["cells"]) == 5 and len(grid["cells"][0]) == 5


def test_sensitivity_accepts_the_old_request():
    grid = client.post("/sensitivity", json=CASE_2).json()
    assert round(grid["cells"][2][2]["gaap"][2] * 100, 1) == 18.3


def test_sensitivity_rejects_unknown_axes():
    response = client.post("/sensitivity", json={"inputs": NEW_FORMAT, "x_axis": "weather"})
    assert response.status_code == 422


def test_save_list_load_delete(fake_db):
    saved = client.post("/deals", json={"name": "Test deal", "inputs": {**NEW_FORMAT, "currency": "INR"}}).json()
    assert fake_db.rows[saved["id"]]["model_version"] == 2
    assert fake_db.rows[saved["id"]]["currency"] == "INR"

    listed = client.get("/deals").json()
    assert listed[0]["currency"] == "INR"

    loaded = client.get(f"/deals/{saved['id']}").json()
    assert loaded["inputs"]["currency"] == "INR"
    assert loaded["results"]["years"][0]["gaap_eps"] == pytest.approx(saved["results"]["years"][0]["gaap_eps"])

    assert client.delete(f"/deals/{saved['id']}").status_code == 200
    assert client.get(f"/deals/{saved['id']}").status_code == 404


def test_old_saved_deals_still_load(fake_db):
    # A deal saved by the original app: flat inputs, old results, version 1.
    old_id = fake_db.add("Old deal", CASE_2, {"eps_before": 2.0, "years": []}, model_version=1)["id"]
    loaded = client.get(f"/deals/{old_id}").json()
    assert loaded["inputs"]["mode"] == "simple"
    assert loaded["currency"] == "USD"
    years = loaded["results"]["years"]
    assert [round(y["gaap_accretion"] * 100, 1) for y in years[:3]] == [-3.0, 8.7, 18.3]


def test_export_returns_a_workbook():
    response = client.post("/export", json={"inputs": NEW_FORMAT, "name": "Acme / Beta"})
    assert response.status_code == 200
    assert response.headers["content-disposition"] == 'attachment; filename="Acme__Beta.xlsx"'
    assert response.content[:2] == b"PK"  # .xlsx files are zip archives
