const { test, expect } = require('@playwright/test');
const guests = require('../guests.json');

for (const width of [390, 1280]) {
    for (const [id, guest] of Object.entries(guests)) {
        test(`${id} at ${width}px only sees invited events`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('/?invite=' + id);
            await expect(page.locator('body')).toHaveClass(/invitation-ready/);
            await page.getByRole('button', { name: 'Passer', exact: true }).click();
            for (const name of ['mairie', 'houppa', 'shabbat']) {
                await expect(page.locator('#' + name)).toBeVisible({ visible: guest[name] });
                await expect(page.locator('#rsvp-' + name)).toBeVisible({ visible: guest[name] });
                await expect(page.locator(`.nav-item[data-target="${name}"]`)).toBeVisible({ visible: guest[name] });
                if (guest[name]) await expect(page.locator(`#${name}-oui`)).toBeEnabled();
                else await expect(page.locator(`#${name}-oui`)).toBeDisabled();
            }
            if (Object.values(guest).includes(true)) {
                await expect(page.locator('#nom')).toHaveValue(guest.nom);
                expect(await page.locator('#nom').evaluate(el => el.readOnly)).toBe(true);
            } else {
                await expect(page.locator('#invitation-status')).toContainText('Aucun événement');
                await expect(page.locator('#reponse')).toBeHidden();
            }
            expect(errors).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        });
    }
}

for (const query of ['', '?invite=inconnu', '?invite=__proto__', '?invite=toString']) {
    test('unavailable invitation ' + query, async ({ page }) => {
        await page.goto('/' + query);
        await expect(page.locator('#invitation-status')).toContainText(query ? 'inconnu' : 'lien personnel');
        await expect(page.locator('#programme')).toBeHidden();
        await expect(page.locator('#reponse')).toBeHidden();
    });
}

test('guest loading failure stays closed', async ({ page }) => {
    await page.route('**/guests.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto('/?invite=ilan-dahan');
    await expect(page.locator('#invitation-status')).toContainText('ne peut pas être chargée');
    await expect(page.locator('#reponse')).toBeHidden();
});

test('RSVP excludes uninvited events and preserves answers', async ({ page }) => {
    let payload;
    await page.route('https://script.google.com/**', route => {
        payload = route.request().postDataJSON();
        return route.fulfill({ status: 200, body: 'OK' });
    });
    await page.goto('/?invite=elie-chicha');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await page.locator('#btn_skip').click();
    await page.locator('#houppa-adultes').selectOption('3');
    await page.locator('.submit-btn').click();
    await expect(page.locator('#confirm-msg')).toContainText('envoyée');
    expect(payload).toMatchObject({ invite: 'elie-chicha', nom: guests['elie-chicha'].nom, mairie: 'Masqué', shabbat: 'Masqué' });
    expect(payload.houppa).toContain('3 adulte(s)');
    await expect(page.locator('#houppa-adultes')).toHaveValue('3');
    await expect(page.locator('#nom')).toHaveValue(guests['elie-chicha'].nom);
});

test('envelope opens and countdown uses Paris time', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-02-18T13:59:30Z') });
    await page.goto('/?invite=ilan-dahan');
    await expect(page.locator('#cd-hours')).toHaveText('01');
    await page.locator('#env-seal').click();
    await page.clock.fastForward(2500);
    await expect(page.locator('body')).toHaveClass(/revealed/);
    await expect(page.locator('body')).not.toHaveClass(/env-locked/);
    await expect(page.locator('#houppa .when')).toContainText('16h00');
    await expect(page.locator('#houppa .where')).toContainText('Factory 58');
    await expect(page.locator('#houppa a.btn')).toHaveAttribute('href', /12%20rue%20Gutenberg/);
});

test('calendar contains 16h Paris and a valid all-day end date', async ({ page }) => {
    await page.goto('/?invite=ilan-dahan');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    const files = await page.evaluate(async () => {
        const blobs = [];
        URL.createObjectURL = blob => { blobs.push(blob); return 'blob:test'; };
        HTMLAnchorElement.prototype.click = () => {};
        downloadIcs('Houppa & Soirée', 'Factory 58, Bobigny', '2027-02-18', '16:00');
        downloadIcs('Mairie', 'Levallois', '2027-02-18');
        return Promise.all(blobs.map(blob => blob.text()));
    });
    expect(files[0]).toContain('DTSTART:20270218T150000Z');
    expect(files[0]).toContain('LOCATION:Factory 58\\, Bobigny');
    expect(files[1]).toContain('DTSTART;VALUE=DATE:20270218');
    expect(files[1]).toContain('DTEND;VALUE=DATE:20270219');
});
