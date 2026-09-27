# Your renewal, {{ data.client_name }}

Your **{{ data.policy_type }}** policy with {{ data.insurer }} renews on **{{ data.renews_on }}**.

| Option | Annual premium |
|---|---|
| Renew with {{ data.insurer }} | ${{ data.renewal_premium }} |
{{#each data.quotes}}| {{ item.insurer }} | ${{ item.premium }} |
{{/each}}

## In plain English

{{ data.summary }}

Reply to switch, or stick with your current insurer. Either way, we handle the paperwork.

{{ business.name }}
