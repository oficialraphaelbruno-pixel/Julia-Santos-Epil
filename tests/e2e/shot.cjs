const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w, h, full] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=> m.type()==='error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: out, fullPage: full === '1' });
  if (errs.length) console.log('ERRORS:', errs.join('\n'));
  await b.close();
})();
