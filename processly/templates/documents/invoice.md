# Invoice {{ data.invoice_number }}

**Bill to:** {{ data.customer }} · **Date:** {{ $substring(now, 0, 10) }}

| SKU | Item | Qty | Price | Total |
|---|---|---|---|---|
{{#each data.lines}}| {{ item.sku }} | {{ item.name }} | {{ item.qty }} | ${{ item.price }} | ${{ item.qty * item.price }} |
{{/each}}

**Total due: ${{ data.total }}** · Payment terms: 30 days.

{{ business.name }}
