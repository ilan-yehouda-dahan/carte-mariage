const { test, expect, chromium, webkit } = require('@playwright/test');
const words = ['קוֹל', 'שָשוֹן', 'וְקוֹל', 'שִמְחָה', 'קוֹל', 'חָתָן', 'וְקוֹל', 'כָּלָה'];
for (const engine of ['chromium', 'webkit']) {
    for (const width of [320, 390, 1280]) {
        test(`Hebrew reads right to left on ${engine} at ${width}px`, async () => {
            const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' ? {channel:'chrome'} : {channel:undefined});
            try {
                const page = await browser.newPage({viewport:{width,height:844}});
                await page.goto('http://127.0.0.1:8765/?preview=1&invite=gabriel-arzoin');
                await expect(page.locator('body')).toHaveClass(/invitation-ready/);
                await page.locator('#btn_skip').click();
                await expect(page.locator('#envelope-screen')).toBeHidden();
                await page.evaluate(() => document.fonts.ready);
                await expect(page.locator('.cover-hebrew')).toHaveAttribute('aria-label', words.join(' '));
                await expect(page.locator('.cover-hebrew span')).toHaveText(words);
                const letters = await page.locator('.cover-hebrew span').evaluateAll(elements => elements.map(el => {
                    const first=document.createRange(), last=document.createRange();
                    first.setStart(el.firstChild,0);first.setEnd(el.firstChild,1);
                    const end=el.textContent.length;
                    last.setStart(el.firstChild,end-1);last.setEnd(el.firstChild,end);
                    const box=el.getBoundingClientRect();
                    return {start:first.getBoundingClientRect().x,end:last.getBoundingClientRect().x,x:box.x,right:box.right};
                }));
                letters.forEach((word,i) => {
                    expect(word.start,words[i]+' letter direction').toBeGreaterThan(word.end);
                    if(i) expect(word.x,'word order').toBeLessThan(letters[i-1].x);
                    expect(word.x).toBeGreaterThanOrEqual(0);
                    expect(word.right).toBeLessThanOrEqual(width);
                });
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                if (engine === 'webkit' && width === 390) await page.locator('#cover').screenshot({path: require('node:path').join(test.info().outputDir, 'hebreu-safari.png')});
            } finally { await browser.close(); }
        });
    }
}
