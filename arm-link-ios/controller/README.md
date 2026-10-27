# ARM Link smooth controller (1.2.2)

The IPA bundles this controller instead of loading the old `/viewer/app.js`.
WKContentRuleList blocks only that script on the configured workspace origin.
A document-end user script starts the bundled module graph on the viewer page.
Authentication, the existing pose API, and the shared deterministic protocol remain unchanged.

- Frame-based, elapsed-time joystick integration, retaining fractional degrees.
- Center deadzone and angle limits; cancel on pointer loss, blur, or background.
- Latest input coalescing; local changes stay visible until their own acknowledgement.
- No per-frame mutation observer or idle 3D rendering; reduced mobile GPU load.

Run `node --test arm-link-ios/Tests/*.test.mjs` and
`python3 arm-link-ios/scripts/bundle-controller.py` before XcodeGen.
The GitHub Actions ARM Link workflow runs both and builds the unsigned IPA.

Physical iPhone smoothness and WKWebView loading need device validation.
