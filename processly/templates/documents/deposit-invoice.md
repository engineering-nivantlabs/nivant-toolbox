# Deposit invoice — {{ data.quote_number }}

**For:** {{ data.customer }} · **Job:** {{ data.description }}

| Item | Amount |
|---|---|
| Quoted total | ${{ data.amount }} |
| Deposit due (30%) | ${{ $round(data.amount * 0.3, 2) }} |

Paying the deposit locks in your start date of {{ data.start_date }}.

{{ business.name }}
