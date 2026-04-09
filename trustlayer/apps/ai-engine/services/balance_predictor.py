from __future__ import annotations

from datetime import datetime
from typing import Any


def predict_balance(payload: dict[str, Any]) -> dict[str, Any]:
    transactions = payload.get("transactions", [])
    current_balance = float(payload.get("current_balance", 0))
    target_date_raw = payload.get("target_date")
    target_date = datetime.fromisoformat(target_date_raw) if target_date_raw else datetime.utcnow()
    today = datetime.now(target_date.tzinfo) if target_date.tzinfo else datetime.utcnow()

    if not transactions:
        return {
            "predicted_balance": current_balance,
            "days_ahead": max((target_date - today).days, 0),
            "warning": None,
        }

    total_outflow = sum(abs(float(tx.get("amount", 0))) for tx in transactions if float(tx.get("amount", 0)) < 0)
    daily_average = total_outflow / max(len(transactions), 1)
    days_ahead = max((target_date - today).days, 0)
    predicted_balance = current_balance - (daily_average * days_ahead)

    return {
        "predicted_balance": round(predicted_balance, 2),
        "days_ahead": days_ahead,
        "warning": "Predicted balance may go negative before target date." if predicted_balance < 0 else None,
    }
