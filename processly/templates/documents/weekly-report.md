# Weekly report — week of {{ data.week }}

## Summary

{{ data.summary }}

## Numbers

| Metric | Value |
|---|---|
| New leads | {{ data.leads }} |
| Enrolments | {{ data.enrolments }} |
| Revenue | ${{ data.revenue }} |
| Ad spend | ${{ data.spend }} |
| Cost per lead | ${{ data.cost_per_lead }} |

## Channels

| Channel | Spend | Leads |
|---|---|---|
{{#each data.channels}}| {{ item.channel }} | ${{ item.spend }} | {{ item.leads }} |
{{/each}}

## Flags

{{#each data.flags}}- **{{ item.type }}**: {{ item.detail }}
{{/each}}
