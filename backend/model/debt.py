# debt.py
# The new acquisition debt, one tranche at a time.
#
# Interest is charged on the balance at the START of each year. This keeps the
# model free of circular references: this year's interest doesn't depend on
# this year's repayments.

from model.ppa import straight_line


class DebtSchedule:
    def __init__(self, tranches, amounts):
        self.tranches = tranches
        self.amounts = amounts
        self.balances = list(amounts)
        self.rows = [[] for _ in tranches]

    def interest(self):
        """Interest for the coming year, on the opening balances."""
        return sum(balance * t.rate for balance, t in zip(self.balances, self.tranches))

    def fee_amortization(self, year):
        return sum(
            straight_line(amount * t.fee_pct, t.term_years, year)
            for amount, t in zip(self.amounts, self.tranches)
        )

    def mandatory_repayments(self):
        return [
            min(balance, t.amortization_pct * amount)
            for balance, amount, t in zip(self.balances, self.amounts, self.tranches)
        ]

    def close_year(self, year, cash_for_debt):
        """Record the year and move to closing balances.

        `cash_for_debt` is the cash available to repay debt. It pays the
        mandatory amortization first; anything left over is swept to the
        tranches in order.
        """
        mandatory = self.mandatory_repayments()
        sweep_left = max(0.0, cash_for_debt - sum(mandatory))
        for i, t in enumerate(self.tranches):
            beginning = self.balances[i]
            after_mandatory = beginning - mandatory[i]
            sweep = min(after_mandatory, sweep_left)
            sweep_left -= sweep
            ending = after_mandatory - sweep
            self.rows[i].append({
                "year": year,
                "beginning": beginning,
                "mandatory": mandatory[i],
                "sweep": sweep,
                "ending": ending,
                "interest": beginning * t.rate,
                "fee_amortization": straight_line(self.amounts[i] * t.fee_pct, t.term_years, year),
            })
            self.balances[i] = ending

    def total_balance(self):
        return sum(self.balances)

    def as_list(self):
        return [
            {"name": t.name, "amount": amount, "rate": t.rate, "term_years": t.term_years,
             "amortization_pct": t.amortization_pct, "fee_pct": t.fee_pct, "years": rows}
            for t, amount, rows in zip(self.tranches, self.amounts, self.rows)
        ]
