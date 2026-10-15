const { test, expect } = require('@playwright/test');
for (const [width, height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[844,390]]) {
    test(`mobile layout ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({width,height});
        await page.goto('/?preview=1&invite=gabriel-arzoin');
        await expect(page.locator('body')).toHaveClass(/invitation-ready/);
        const bounds = async selector => page.locator(selector).evaluate(el => {
            const r = el.getBoundingClientRect();
            return { left:r.left, right:r.right, top:r.top, bottom:r.bottom };
        });
        for (const selector of ['.cenv-intro','#env-seal','.cenv-cta']) {
            const r = await bounds(selector);
            expect(r.left,selector).toBeGreaterThanOrEqual(0);
            expect(r.right,selector).toBeLessThanOrEqual(width);
            expect(r.top,selector).toBeGreaterThanOrEqual(0);
            expect(r.bottom,selector).toBeLessThanOrEqual(height);
        }
        await page.locator('#btn_skip').click();
        for (const selector of ['.cover-content','.countdown','.bottom-nav-dock','#houppa .fp-names','.rsvp-card','.presence-options','.submit-btn']) {
            for (const el of await page.locator(selector).all()) {
                const r = await el.boundingBox();
                expect(r.x,selector).toBeGreaterThanOrEqual(-1);
                expect(r.x+r.width,selector).toBeLessThanOrEqual(width+1);
            }
        }
        for (const selector of ['.nav-item', '.presence-options label', '.count-row select']) {
            for (const el of await page.locator(selector).all()) {
                expect((await el.boundingBox()).height, selector + ' touch target').toBeGreaterThanOrEqual(43.9);
            }
        }
        const fontSize = await page.locator('#message').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize, 'mobile form text size').toBeGreaterThanOrEqual(16);
    });
}
