const { test, expect } = require('@playwright/test');
const { backend } = require('./support/apps-script.cjs');
const fs = require('node:fs/promises');
async function wire(context, api) {
    await context.route('https://script.google.com/**', async route => {
        const request = route.request();
        expect(request.url()).not.toContain('adminKey');
        if (request.method() === 'POST') {
            const body = request.postData();
            const form = new URLSearchParams(body);
            if (form.has('payload')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: api.rawPostForm(JSON.parse(form.get('payload'))) });
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(api.post(JSON.parse(body))) });
        }
        return route.fulfill({ contentType: 'application/javascript', body: api.rawGet(Object.fromEntries(new URL(request.url()).searchParams)) });
    });
}
async function login(page, family) {
    await page.goto('/admin' + family + '/#acces=' + (family === 'dahan' ? 'a' : 'b').repeat(40));
    await expect(page.locator('#private-space')).toBeVisible();
}
for (const width of [360, 1280]) {
    test(`create parents-only invitation at ${width}px`, async ({page}) => {
        await page.setViewportSize({width, height:844});
        await page.route('https://script.google.com/**', () => { throw new Error('Preview must never contact Google'); });
        await page.goto('/admindahan/?preview=1');
        await page.getByLabel('Nom de la famille ou des invités').fill('Sarah et David Cohen');
        await page.locator('#create-button').click();
        await expect(page.locator('#result')).toBeVisible();
        const link = await page.locator('#invite-url').inputValue();
        expect(link).toContain('preview=1');
        expect(new URL(link).pathname).toBe('/');
        const whatsapp = new URL(await page.locator('#whatsapp-link').getAttribute('href'));
        expect(whatsapp.hostname).toBe('wa.me');
        const message = whatsapp.searchParams.get('text');
        expect(message).toContain('Hachem'); expect(message).toContain('Bé’ezrat Hachem'); expect(message).toContain(link);
        expect(message).not.toMatch(/clé|adminKey|Famille Dahan|Famille Chiche/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto(link);
        await expect(page.locator('body')).toHaveClass(/invitation-ready/);
        await page.locator('#btn_skip').click();
        await expect(page.locator('#nom')).toHaveValue('Sarah et David Cohen');
        await expect(page.locator('#houppa-personnes option')).toHaveText(['1','2']);
        await expect(page.locator('#houppa-enfants')).toHaveCount(0);
        await expect(page.locator('#mairie')).toBeHidden();
        await expect(page.locator('#shabbat')).toBeHidden();
        await expect(page.locator('.submit-btn')).toBeDisabled();
    });
}
test('preview pages show only their own households', async ({page}) => {
    await page.goto('/admindahan/?preview=1');
    await page.locator('#guest-name').fill('Foyer Dahan test'); await page.locator('#create-button').click();
    await expect(page.locator('#guest-list')).toContainText('Foyer Dahan test');
    await page.goto('/adminchiche/?preview=1');
    await expect(page.locator('#guest-list')).not.toContainText('Foyer Dahan test');
    await page.locator('#guest-name').fill('Foyer Chiche test'); await page.locator('#create-button').click();
    await expect(page.locator('#guest-list')).toContainText('Foyer Chiche test');
    await page.goto('/admindahan/?preview=1');
    await expect(page.locator('#guest-list')).toContainText('Foyer Dahan test');
    await expect(page.locator('#guest-list')).not.toContainText('Foyer Chiche test');
});
test('admin without events cannot generate a link', async ({page}) => {
    await page.goto('/adminchiche/?preview=1');
    await page.locator('#guest-name').fill('Famille test'); await page.locator('#houppa').uncheck();
    await page.locator('#create-button').click();
    await expect(page.locator('#form-feedback')).toContainText('au moins un événement');
    await expect(page.locator('#result')).toBeHidden();
});
test('live separation, creation, WhatsApp, RSVP, latest counts and CSV end to end', async ({page,context}) => {
    const api = backend(); api.tables['Invités'] = [api.tables['Invités'][0]];
    await wire(context, api);
    await page.goto('/adminchiche/');
    await expect(page.locator('#private-space')).toBeHidden();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await page.goto('/adminchiche/#acces=' + 'a'.repeat(40));
    await expect(page.locator('#login-feedback')).toContainText('Ce lien ne permet pas');
    await expect(page.locator('#private-space')).toBeHidden();
    await login(page, 'dahan');
    await page.locator('#guest-name').fill('Sarah et David Cohen');
    await page.locator('#mairie').check(); await page.locator('#create-button').click();
    await expect(page.locator('#form-feedback')).toContainText('Invitation enregistrée');
    await expect(page.locator('#guest-list')).toContainText('Sarah et David Cohen');
    const link = await page.locator('#invite-url').inputValue();
    const id = new URL(link).searchParams.get('invite');
    expect(new URL(link).searchParams.get('nom')).toBe('Sarah et David Cohen');
    expect(link).not.toContain('dahan');
    expect(link).not.toContain('acces');
    expect(link).not.toContain('a'.repeat(40));
    await context.route('https://wa.me/**', route => route.fulfill({contentType:'text/html',body:'<h1>Préparation WhatsApp simulée</h1>'}));
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#whatsapp-link').click(); const popup = await popupPromise; await popup.waitForLoadState();
    const text = new URL(popup.url()).searchParams.get('text');
    expect(text).toContain('immense gratitude envers Hachem'); expect(text).toContain('Bé’ezrat Hachem'); expect(text).toContain(link);
    expect(text).not.toContain('a'.repeat(40));
    await popup.close();
    // Tester le même lien sur l'origine locale avec le vrai code Apps Script et un Sheets simulé.
    await page.goto('/?invite=' + id);
    await expect(page.locator('body')).toHaveClass(/invitation-ready/); await page.locator('#btn_skip').click();
    await page.locator('#houppa-personnes').selectOption('2'); await page.locator('.submit-btn').click();
    await expect(page.locator('#confirm-msg')).toContainText('bien été enregistrée');
    await login(page,'dahan');
    const houppa = page.locator('#totals tr').filter({hasText:'Houppa & soirée'});
    await expect(houppa.locator('td')).toHaveText(['Houppa & soirée','2','2','0','0']);
    // Une réponse corrigée crée de l'historique, sans doubler les effectifs.
    expect(api.post({invite:id,requestId:'00000000-0000-4000-8000-000000000001',events:{mairie:{presence:'non'},houppa:{presence:'oui',personnes:1}},message:''}).ok).toBe(true);
    await page.locator('#refresh').click();
    await expect(houppa.locator('td')).toHaveText(['Houppa & soirée','2','1','0','0']);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await downloadPromise; expect(download.suggestedFilename()).toBe('effectifs-dahan.csv');
    expect(await fs.readFile(await download.path(),'utf8')).toContain('"Houppa & soirée";"2";"1";"0";"0"');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('a'.repeat(40));
    await page.locator('#logout').click(); await expect(page.locator('#private-space')).toBeHidden(); await expect(page.locator('#guest-list')).toBeEmpty(); expect(new URL(page.url()).hash).toBe('');
    await login(page,'chiche');
    await expect(page.locator('#guest-list')).not.toContainText('Sarah et David Cohen');
    await expect(page.locator('#totals tr').filter({hasText:'Houppa & soirée'}).locator('td')).toHaveText(['Houppa & soirée','0','0','0','0']);
});

test('a bare family address does not request or display private data', async ({page}) => {
    let calls=0;
    await page.route('https://script.google.com/**',route=>{calls++;return route.abort();});
    await page.goto('/admindahan/');
    await expect(page.locator('#private-space')).toBeHidden();
    await expect(page.locator('#login-feedback')).toContainText('lien privé');
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    expect(calls).toBe(0);
});


test('search and reminders respect pending replies, family boundaries and full totals', async ({ page, context }) => {
    const api = backend();
    api.tables['Invités'] = [api.tables['Invités'][0],
        ['pending', 'Élodie Cohen', 'oui', 'oui', 'non', 2, 0, 'dahan'],
        ['absent', 'David Cohen', 'non', 'oui', 'non', 2, 0, 'dahan'],
        ['private', 'Élodie Chiche', 'oui', 'oui', 'non', 2, 0, 'chiche']];
    expect(api.post({invite:'absent',requestId:'00000000-0000-4000-8000-000000000010',events:{houppa:{presence:'non'}},message:''}).ok).toBe(true);
    await wire(context, api);
    await page.setViewportSize({width:360,height:844});
    await login(page, 'dahan');
    await expect(page.locator('#guest-list tr')).toHaveCount(2);
    const totals = await page.locator('#totals').innerText();
    await page.locator('#guest-search').fill('elodie');
    await expect(page.locator('#guest-list tr')).toHaveCount(1);
    await expect(page.locator('#guest-list')).toContainText('Élodie Cohen');
    await expect(page.locator('#guest-list')).not.toContainText('Chiche');
    await page.locator('#guest-filter').selectOption('pending');
    await page.getByRole('button', {name:'Préparer une relance'}).click();
    const message = await page.locator('#whatsapp-message').inputValue();
    expect(message).toContain('Élodie Cohen'); expect(message).toContain('Bé’ezrat Hachem');
    expect(message).toContain('Mairie'); expect(message).toContain('Houppa'); expect(message).not.toContain('Chabbat');
    expect(message).not.toContain('a'.repeat(40));
    const whatsapp = new URL(await page.locator('#whatsapp-link').getAttribute('href'));
    expect(whatsapp.searchParams.get('text')).toBe(message);
    expect(new URL(await page.locator('#invite-url').inputValue()).searchParams.get('nom')).toBe('Élodie Cohen');
    expect(await page.locator('#totals').innerText()).toBe(totals);
    await page.locator('#guest-search').fill('David');
    await expect(page.locator('#guest-list tr')).toHaveCount(0);
    await expect(page.locator('#empty-list')).toContainText('Aucun invité');
    await page.locator('#guest-filter').selectOption('all');
    await expect(page.locator('#guest-list tr')).toHaveCount(1);
    await expect(page.getByRole('button', {name:'Préparer une relance'})).toHaveCount(0);
    await page.locator('#guest-search').fill('');
    await page.locator('#guest-filter').selectOption('pending');
    await page.locator('#refresh').click();
    await expect(page.locator('#guest-list tr')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
