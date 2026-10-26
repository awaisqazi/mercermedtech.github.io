# Digital Literacy interest form

- **Google Form** "Digital Literacy Training: interest form", owned by mercermedtech@gmail.com. Edit: https://docs.google.com/forms/d/1wkv2B-7blx5vkuqHNXmE7XLzJc6SWst6MoDSpv-6CpE/edit · Public: https://docs.google.com/forms/d/e/1FAIpQLSdt6Zl1Ecv49ALSWxAAtiOkWBLQJ2vV81lgyuCt6CSUGb4xnA/viewform
- **Site:** `src/components/DltInterestForm.astro`, on `/` and `/es/` (Tech column, `#dlt-interest`) and `/digital-literacy/` and `/es/digital-literacy/` (`#interest`). Posts to `.../formResponse` through a hidden iframe, like the contact form. Required: name, plus phone or email (checked by the page script).
- **Responses** land in the form's Responses tab (no Sheet linked yet; use "Link to Sheets" to add one). "Submitted from" says which page and language.
- **Entry ids:** name 330196929 · phone 1208529879 · email 2122843499 · county 23947013 · TANF/SNAP 210728030 · language 575477385 · how heard 137405449 · referred by 703509959 · AOSOS 704622938 · anything else 1944461321 · submitted from 943507853 (hidden).
- **Choices (values sent, English on both locales):** county Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset, Union, Other · TANF, SNAP, Both, Neither / not sure · English, Spanish · Caseworker or county agency, One-Stop Career Center, Friend or family, Facebook or Instagram, Flyer, Other.
- **To add a choice:** 1) add it in the Google Form first, spelled exactly; 2) add `{ value, label }` in `DltInterestForm.astro` with the label in `src/i18n/en.ts` and `es.ts` (`dltInterest.form`); 3) add the value to `INTEREST_CHOICES` in `scripts/check-form-contract.mjs`; 4) `npm run build && npm run check:all`.
- **Changing a question** in Google can change its entry id: re-read the ids from the public form (`FB_PUBLIC_LOAD_DATA_`) and update the component, the check script, and this note.
- No spam check (no Turnstile/Worker), unlike the hidden sign-up form. If junk responses arrive, move it behind the mmt-signup Worker.
