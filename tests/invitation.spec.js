const { test, expect } = require('@playwright/test');
const guests = require('../guests.json');

const apiPattern = 'https://script.google.com/**';
async function respond(route, data) {
    const url = new URL(route.request().url());
    const callback = url.searchParams.get('callback');
    await route.fulfill({ contentType: 'application/javascript', body: callback + '(' + JSON.stringify(data) + ');' });
}
test.beforeEach(async ({ page }) => {
    await page.route(apiPattern, async route => {
        if (route.request().method() === 'POST') throw new Error('Unexpected real submission');
        const id = new URL(route.request().url()).searchParams.get('id');
        return respond(route, Object.hasOwn(guests, id) ? guests[id] : { error: 'not_found' });
    });
});

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
    await page.route(apiPattern, route => route.abort());
    await page.goto('/?invite=ilan-dahan');
    await expect(page.locator('#invitation-status')).toContainText('ne peut pas être chargée');
    await expect(page.locator('#reponse')).toBeHidden();
});

test('RSVP only confirms a saved receipt and excludes uninvited events', async ({ page }) => {
    let payload;
    await page.route(apiPattern, route => {
        if (route.request().method() === 'POST') {
            payload = route.request().postDataJSON();
            return route.fulfill({ status: 200, body: 'OK' });
        }
        const url = new URL(route.request().url());
        if (url.searchParams.get('action') === 'status') return respond(route, { ok: true, saved: true, requestId: payload.requestId });
        return route.fallback();
    });
    await page.goto('/?invite=elie-chicha');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await page.locator('#btn_skip').click();
    await page.locator('#houppa-personnes').selectOption('3');
    await page.locator('.submit-btn').click();
    await expect(page.locator('#confirm-msg')).toContainText('bien été enregistrée');
    expect(payload.invite).toBe('elie-chicha');
    expect(payload.events).toEqual({ houppa: { presence: 'oui', personnes: 3 } });
    await expect(page.locator('#houppa-personnes')).toHaveValue('3');
});

test('unconfirmed POST does not show success, retry keeps request ID', async ({ page }) => {
    const ids = [];
    await page.route(apiPattern, route => {
        if (route.request().method() === 'POST') {
            ids.push(route.request().postDataJSON().requestId);
            return route.fulfill({ status: 200, body: 'OK' });
        }
        if (new URL(route.request().url()).searchParams.get('action') === 'status') {
            return respond(route, { ok: true, saved: ids.length > 1, requestId: ids.at(-1) });
        }
        return route.fallback();
    });
    await page.goto('/?invite=elie-chicha');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await page.locator('#btn_skip').click();
    await page.locator('.submit-btn').click();
    await expect(page.locator('#confirm-msg')).toContainText('ne pouvons pas confirmer');
    await page.locator('.submit-btn').click();
    await expect(page.locator('#confirm-msg')).toContainText('bien été enregistrée');
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
});

test('legacy id links load the guest', async ({ page }) => {
    await page.goto('/?id=ilan-dahan');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await expect(page.locator('#nom')).toHaveValue(guests['ilan-dahan'].nom);
});

test('envelope opens and countdown uses Paris time', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-02-18T13:59:30Z') });
    await page.goto('/?invite=ilan-dahan');
    await expect(page.locator('#cd-hours')).toHaveText('01');
    await page.locator('#env-seal').click();
    await page.clock.runFor(2400);
    await expect(page.locator('#cenv-card')).toHaveClass(/cenv-unfolded/);
    await expect(page.locator('body')).not.toHaveClass(/revealed/);
    await page.clock.runFor(2200);
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
        downloadIcs('Mairie', 'Levallois', '2027-02-11');
        return Promise.all(blobs.map(blob => blob.text()));
    });
    expect(files[0]).toContain('DTSTART:20270218T150000Z');
    expect(files[0]).toContain('LOCATION:Factory 58\\, Bobigny');
    expect(files[1]).toContain('DTSTART;VALUE=DATE:20270211');
    expect(files[1]).toContain('DTEND;VALUE=DATE:20270212');
});

 test('local preview works without Google and never submits', async ({ page }) => {
    await page.route(apiPattern, () => { throw new Error('Preview must not contact Google'); });
    await page.goto('/?preview=1&invite=gabriel-arzoin');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await page.locator('#btn_skip').click();
    await expect(page.locator('#local-preview-notice')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeDisabled();
    await expect(page.locator('#shabbat')).toBeVisible();
});

test('mairie date is February 11 in programme, RSVP, calendar and admin', async ({page}) => {
    await page.goto('/?preview=1&invite=gabriel-arzoin');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await expect(page.locator('#mairie .when')).toHaveText('Jeudi 11 février 2027');
    await expect(page.locator('#rsvp-mairie .rsvp-event-title')).toContainText('11 février');
    await expect(page.locator('#mairie button.btn')).toHaveAttribute('onclick', /2027-02-11/);
    await expect(page.locator('#houppa .when')).toContainText('18 février 2027');
    await page.goto('/admindahan/?preview=1');
    await expect(page.locator('label').filter({has:page.locator('#mairie')})).toContainText('11 février');
});

test('personal welcome appears on envelope, card and cover without capacity announcement', async ({page}) => {
    await page.goto('/?preview=1&invite=ilan-dahan');
    await expect(page.locator('body')).toHaveClass(/invitation-ready/);
    await expect(page.locator('#envelope-recipient')).toHaveText('ilan dahan');
    await expect(page.locator('#card-recipient')).toHaveText('Pour ilan dahan');
    await page.locator('#btn_skip').click();
    await expect(page.locator('#cover-recipient')).toHaveText('ilan dahan,');
    await expect(page.locator('.cover-invite')).toContainText('Hachem');
    await expect(page.locator('#invitation-capacity')).toHaveCount(0);
    await expect(page.locator('#houppa-personnes option')).toHaveText(['1','2']);
    await expect(page.locator('#houppa-enfants')).toHaveCount(0);
});
