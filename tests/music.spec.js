const {test,expect}=require('@playwright/test');
for(const width of [360,1280]) {
    test(`music starts only on discovery click and can pause/resume at ${width}px`,async({page})=>{
        await page.setViewportSize({width,height:844});
        await page.clock.install();
        await page.goto('/?preview=1&invite=gabriel-arzoin');
        const audio=page.locator('#wedding-music');
        expect(await audio.evaluate(a=>a.paused)).toBe(true);
        await page.locator('#env-seal').click();
        await page.clock.runFor(2400);
        expect(await audio.evaluate(a=>a.paused)).toBe(true);
        await page.locator('#btn-enter').click();
        await expect.poll(()=>audio.evaluate(a=>!a.paused && a.readyState>=2)).toBe(true);
        await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed','true');
        await page.locator('#music-toggle').click();
        expect(await audio.evaluate(a=>a.paused)).toBe(true);
        await page.locator('#music-toggle').click();
        await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed','true');
        const bounds=await page.locator('#music-toggle').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(await audio.evaluate(a=>a.loop)).toBe(true);
    });
}
test('blocked playback leaves a retry button and invitation usable',async({page})=>{
    await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Blocked','NotAllowedError'));};});
    await page.goto('/?preview=1&invite=gabriel-arzoin');
    await page.locator('#btn_skip').click();
    await page.locator('.cover-enter').click();
    await expect(page.locator('#music-status')).toContainText('réessayer');
    await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#programme')).toBeVisible();
});
