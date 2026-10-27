# Web fonts

The two typefaces the site uses, served from this site so pages make no
request to a font service. Both are variable fonts, latin subset only (it
covers English and every Spanish letter and mark). The `@font-face` rules
are in `src/styles/fonts.css`; `src/layouts/BaseLayout.astro` preloads both
files.

| File | Family | Version | Axes | Source |
| --- | --- | --- | --- | --- |
| `fraunces-latin.woff2` | Fraunces | v38 | opsz 9-144, wght, SOFT 0-100, WONK 0-1 | https://fonts.gstatic.com/s/fraunces/v38/6NUV8FyLNQOQZAnv9ZwIlOkuy91B.woff2 |
| `plus-jakarta-sans-latin.woff2` | Plus Jakarta Sans | v12 | wght 200-800 | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yygg_vb.woff2 |

These are the latin files Google Fonts serves for
`family=Fraunces:opsz,wght,SOFT,WONK@9..144,500..700,0..100,0..1` and
`family=Plus+Jakarta+Sans:wght@400..800`.

## Licence

Both families are licensed under the SIL Open Font License 1.1:

- `OFL-Fraunces.txt`, from https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt
- `OFL-PlusJakartaSans.txt`, from https://github.com/google/fonts/blob/main/ofl/plusjakartasans/OFL.txt

## Updating

Fetch the Google Fonts CSS for the families above with a current browser
user agent, take the `/* latin */` file URLs, replace the files here (keep
the names), and re-check the fallback values in `src/styles/fonts.css`
against the new files' metrics.
