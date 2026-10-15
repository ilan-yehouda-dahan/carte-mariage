const {test,expect} = require('@playwright/test');
for(const width of [360,1280]) {
    test(`create parents-only invitation at ${width}px`, async ({page}) => {
        await page.setViewportSize({width,height:844});
        await page.route('https://script.google.com/**',()=>{throw new Error('Preview must never contact Google');});
        await page.goto('/admin.html?preview=1');
        await page.getByLabel('Nom de la famille ou des invités').fill('Sarah et David Cohen');
        await page.getByLabel('Adultes maximum').fill('2');
        await page.getByLabel('Enfants maximum').fill('0');
        await page.locator('#create-button').click();
        await expect(page.locator('#result')).toBeVisible();
        const link = await page.locator('#invite-url').inputValue();
        expect(link).toContain('preview=1');
        expect(link).toContain('invite=');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.goto(link);
        await expect(page.locator('body')).toHaveClass(/invitation-ready/);
        await page.locator('#btn_skip').click();
        await expect(page.locator('#nom')).toHaveValue('Sarah et David Cohen');
        await expect(page.locator('#houppa-adultes option')).toHaveText(['1','2']);
        await expect(page.locator('#houppa-enfants')).toBeHidden();
        await expect(page.locator('#mairie')).toBeHidden();
        await expect(page.locator('#shabbat')).toBeHidden();
        await expect(page.locator('.submit-btn')).toBeDisabled();
    });
}
test('admin without events cannot generate a link',async({page})=>{
    await page.goto('/admin.html?preview=1');
    await page.locator('#guest-name').fill('Famille test');
    await page.locator('#houppa').uncheck();
    await page.locator('#create-button').click();
    await expect(page.locator('#form-feedback')).toContainText('au moins un événement');
    await expect(page.locator('#result')).toBeHidden();
});
test('live creation sends key only in POST body and confirms saved guest',async({page})=>{
    let payload;
    await page.route('https://script.google.com/**',async route=>{
        const request=route.request();
        expect(request.url()).not.toContain('SECRET');
        if(request.method()==='POST'){
            payload=request.postDataJSON();
            return route.fulfill({status:200,body:'OK'});
        }
        const url=new URL(request.url());
        const guest={...payload};delete guest.adminKey;delete guest.action;
        return route.fulfill({contentType:'application/javascript',body:url.searchParams.get('callback')+'('+JSON.stringify(guest)+');'});
    });
    await page.goto('/admin.html');
    await page.locator('#guest-name').fill('Famille Cohen');
    await page.locator('#admin-key').fill('SECRET'.repeat(8));
    await page.locator('#create-button').click();
    await expect(page.locator('#form-feedback')).toContainText('Invitation enregistrée');
    expect(payload.adminKey).toBe('SECRET'.repeat(8));
    expect(payload.maxEnfants).toBe(0);
    await expect(page.locator('#invite-url')).toHaveValue(new RegExp('https://mariage-eden-ilan.com/\\?invite='));
    expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('SECRET');
});
