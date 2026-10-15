module.exports = {
    testDir: './tests',
    use: { baseURL: 'http://127.0.0.1:8765', channel: 'chrome', headless: true, timezoneId: 'America/New_York' },
    webServer: { command: 'python3 -m http.server 8765 --bind 127.0.0.1', url: 'http://127.0.0.1:8765', reuseExistingServer: true, stdout: 'ignore', stderr: 'ignore' },
};
