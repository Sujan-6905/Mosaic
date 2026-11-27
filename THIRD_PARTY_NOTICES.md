# Third-party notices

Mosaic is released under the MIT License (see `LICENSE`). It includes or depends on the work below, each under
its own license.

## Included in this repository

| Work                                                                                   | Where                                         | License                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| [Beautiful UI](https://github.com/slev12397/beautiful-ui) by Shane Levine              | `frontend/src/components/vendor/beautifulUi/` | MIT, see the `LICENSE` file in that folder                                      |
| [Sona UI](https://github.com/Dinil-Thilakarathne/sona-ui) by Dinil Thilakarathne       | `frontend/src/components/vendor/sona/`        | MIT, see the `LICENSE` file in that folder                                      |
| [Lucide](https://lucide.dev) icon paths                                                | `shared/canvas/diagramStyles/glyphs.js`       | ISC, with portions from Feather under MIT; the notice is at the top of the file |
| [Draco](https://github.com/google/draco) WebAssembly decoder, as shipped with three.js | `frontend/public/draco/`                      | Apache License 2.0, Copyright Google LLC                                        |

The 3D models in `frontend/public/models/` were made for Mosaic and are covered by its MIT License.

The demo film in `frontend/public/media/` was recorded from Mosaic. Its music is "Simplicity" by
[Scott Buckley](https://www.scottbuckley.com.au), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
credited where the film plays.

## Dependencies that ask for attribution

Packages installed from npm keep their own licenses, recorded in each package's `package-lock.json` and
`node_modules`. Most are MIT, ISC, BSD or Apache 2.0. These need a mention beyond that:

- **Font Awesome Free** icons (`@fortawesome/free-solid-svg-icons`): icons under CC BY 4.0, code under MIT.
  Icons by [Font Awesome](https://fontawesome.com).
- **GSAP** (`gsap`): the [GSAP Standard License](https://gsap.com/standard-license), free to use, including
  commercially.
- **Iconify icon sets** used by the assistant's icon search: Carbon (Apache 2.0), Lucide (ISC), Tabler (MIT),
  Devicon (MIT), Simple Icons and SVG Logos (CC0). Brand logos remain trademarks of their owners.
- **web-push** (`web-push`): Mozilla Public License 2.0, used unmodified.
- **Couchbase Node.js SDK** and **Ottoman** (`couchbase`, `ottoman`): Apache License 2.0.

## Fonts

Hanken Grotesk and Azeret Mono are served by Google Fonts under the SIL Open Font License 1.1. Zodiak, the display
face, is served by Fontshare under the ITF Free Font License.
