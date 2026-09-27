# Catering quote {{ data.quote_number }}

**For:** {{ data.client }} · **Event date:** {{ data.event_date }} · **Guests:** {{ data.guests }}

## Menu: {{ data.package.name }}

{{ data.package.description }}

| Item | Qty | Unit | Total |
|---|---|---|---|
| {{ data.package.name }} (per head) | {{ data.guests }} | ${{ data.package.per_head }} | ${{ data.guests * data.package.per_head }} |
{{#each data.extras}}| {{ item.name }} | {{ item.qty }} | ${{ item.price }} | ${{ item.qty * item.price }} |
{{/each}}

**Total: ${{ data.total }}**

{{ data.notes }}

---

Quote valid for 14 days. A 30% deposit confirms the date. {{ business.name }}
