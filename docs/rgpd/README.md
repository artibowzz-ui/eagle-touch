# Eagle Touch: internal GDPR file

Internal documents for the controller (Arthur Petit, Ghent, Belgium, admineagletouch@gmail.com).
They are not shown on the site. Keep them up to date when the app or its providers change.
Last review: 20 October 2026.

This file is practical guidance, not legal advice. For anything unusual, check with the Belgian
Data Protection Authority (APD/GBA, www.autoriteprotectiondonnees.be / www.gegevensbeschermingsautoriteit.be)
or a lawyer.

---

## 1. Record of processing activities (GDPR article 30)

| | |
|---|---|
| **Controller** | Arthur Petit, Ghent, Belgium, admineagletouch@gmail.com |
| **Purpose** | Running golf competitions between friends: accounts, rounds, scores, rankings, challenges, Eagle Touch index |
| **Legal basis** | Contract (art. 6.1.b) for the service; legitimate interest (art. 6.1.f) for security and abuse prevention |
| **People concerned** | Registered players; guests without an account added by a competition admin |
| **Data** | Email, hashed password, first and last name, gender (to pick men's or ladies' cards), declared index and its history, optional photo, competitions joined, round answers, strokes per hole, challenge results, playing handicaps, Eagle Touch index, golf courses added, failed invite-code attempts (kept 1 day), technical logs at the hosts |
| **Sensitive data** | None (no health data, no location, no payment data) |
| **Who receives it** | Members of the same competitions (names, photo, index, results); competition admins (can correct entries and cards); the processors below |
| **Processors** | Supabase (database and accounts, EU region Frankfurt), Vercel (hosting), Brevo / Sendinblue SAS (service emails) |
| **Transfers outside the EEA** | Supabase and Vercel are US companies: covered by the EU Standard Contractual Clauses in their DPAs and/or the EU-US Data Privacy Framework |
| **Retention** | As long as the account exists; deleted immediately on account deletion; failed code attempts 1 day; host logs per the hosts' own short cycles |
| **Security** | HTTPS everywhere; row-level security on every table; internal functions not exposed to the API; no anonymous access to tables; email never shown to other players; security headers (CSP, HSTS, no framing); invite codes random and rate-limited |
| **Automated processing** | Eagle Touch index computed automatically; used for playing handicaps only in competitions whose admin chose it; the admin can always override |

---

## 2. Data processing agreements (article 28)

All three providers include their DPA in their terms: accepting the terms when creating the account counts as
signing it. Nothing has to be countersigned, but you should **download each DPA once and note the date**, so you can
show it if ever asked.

| Provider | Role | Where to find the DPA | Done (date) |
|---|---|---|---|
| Supabase | Database, accounts | supabase.com/legal/dpa | |
| Vercel | Hosting | vercel.com/legal/dpa | |
| Brevo (Sendinblue SAS) | Service emails | Appendix 3 of the Brevo terms, brevo.com/legal/termsofuse | |

If you add a new provider that receives personal data (analytics, payments, notifications), add it here, add it to
the privacy page, and check its DPA first.

---

## 3. Data breach procedure (articles 33 and 34)

A breach is any incident where personal data is lost, destroyed, changed, disclosed or accessed without
permission: for example a leaked database key, a bug that shows one player's data to another, a provider reporting
an incident, or a lost laptop with an open session to the Supabase dashboard.

**Clock: the APD must be notified within 72 hours of becoming aware of the breach**, unless it is unlikely to create
a risk for the people concerned.

1. **Contain (immediately)**
   - Rotate any exposed key: Supabase > Project Settings > API (and Vercel environment variables, then redeploy).
   - Change the passwords of your Supabase, Vercel, Brevo and GitHub accounts if they may be involved.
   - Fix or switch off the faulty feature (revert the last push on GitHub if a recent change caused it).
2. **Assess (same day)**: what data, how many players, since when, who could see it, is it still exposed.
   Supabase > Logs and Vercel > Logs help.
3. **Decide**
   - Unlikely to create a risk (for example only golf course data, or data already visible to the same people):
     no notification, but **write it in the breach log below**.
   - Risk for players (emails, names with scores visible to strangers, passwords): **notify the APD within 72 hours**
     through its online form ("Signaler une fuite de données" / "Datalek melden"). You can notify in stages if
     details are still missing.
   - High risk (for example passwords or emails publicly exposed): **also tell the players concerned** without
     delay, in plain language: what happened, what data, what you did, what they should do (change password).
4. **Follow up**: fix the cause, test, and note in the log what was changed.

### Breach log

| Date found | What happened | Data and players concerned | Risk | APD notified? | Players told? | Fix |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## 4. Requests from players (articles 12 to 22)

Most rights are self-service in the app: correct data in Profil, "Télécharger mes données" (copy), "Supprimer mon
compte" (erasure). For anything else (objection, restriction, a guest without an account, a question):

1. Answer within **one month** of the request (extendable by two months for complex cases, with an explanation).
2. Make sure the request comes from the person concerned (reply from the email of the account).
3. For a guest without an account: ask the competition admin to correct or delete the guest, or do it in Supabase.
4. Keep a short note: date, who, what was asked, what was done.

---

## 5. Yearly check (5 minutes)

- Providers unchanged? If not, update the privacy page and section 2.
- Privacy page and terms still match what the app does?
- Supabase Security Advisor clean?
- Breach log and requests reviewed.
