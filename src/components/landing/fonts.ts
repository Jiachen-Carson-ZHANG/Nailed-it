// The landing page previously loaded Source Han Serif via next/font/local. Those vendored font binaries
// (189M, mostly unused weights) were removed from the repo. LandingPage.module.css already falls back to
// 'Songti SC' / 'STSong' / serif when --font-landing-serif is unset, so the landing still renders a CJK
// serif without shipping any .otf. Shape (className/variable) kept so consumers + the page test are stable.
export const landingSerif = { className: '', variable: '' } as const;
