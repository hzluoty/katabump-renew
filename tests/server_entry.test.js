const assert = require('assert');
const { classifyMissingRenew, resolveServerEntry } = require('../lib/server_entry');

function stubPage({ entries = 0, text = '', renewVisible = false, countThrows = false } = {}) {
    const seeLocator = {
        waitFor: async ({ state }) => {
            if (state === 'visible' && entries === 0) throw new Error('see entry not visible');
        },
        getAttribute: async () => '/servers/edit?id=363231',
        click: async () => {}
    };
    return {
        reloaded: 0,
        url: () => 'https://dashboard.katabump.com/dashboard',
        evaluate: async () => text,
        reload: async function () { this.reloaded++; },
        locator: () => ({
            count: async () => { if (countThrows) throw new Error('detached'); return entries; },
            first: () => seeLocator
        }),
        getByRole: () => ({
            first: () => ({
                waitFor: async () => { if (!renewVisible) throw new Error('renew button missing'); },
                isVisible: async () => renewVisible
            })
        }),
        waitForURL: async () => {}
    };
}

async function tests() {
    // 有服务器且详情页 Renew 就绪
    const ready = stubPage({ entries: 1, text: 'Your servers 1', renewVisible: true });
    const readyResult = await resolveServerEntry(ready, { waitMs: 1, renewWaitMs: 1 });
    assert.strictEqual(readyResult.ready, true);
    assert.strictEqual(readyResult.status, 'ready');
    assert.strictEqual(ready.reloaded, 0);

    // 账号下没有服务器 → not_ready（非错误终态），且不需要刷新重试
    // 文案取自真实快照：actions/runs/39000012720 → login_after_submit_*.html
    const empty = stubPage({ entries: 0, text: 'Your servers 0\nServers You not have servers.' });
    const emptyResult = await resolveServerEntry(empty, { waitMs: 1, renewWaitMs: 1 });
    assert.strictEqual(emptyResult.ready, false);
    assert.strictEqual(emptyResult.status, 'not_ready');
    assert.strictEqual(empty.reloaded, 0);

    // 有服务器但 Renew 始终不出现 → 刷新一次后仍是识别失败（保持 FATAL）
    const broken = stubPage({ entries: 1, text: 'Your servers 1', renewVisible: false });
    const brokenResult = await resolveServerEntry(broken, { waitMs: 1, renewWaitMs: 1 });
    assert.strictEqual(brokenResult.ready, false);
    assert.strictEqual(brokenResult.status, 'server_entry_not_ready');
    assert.strictEqual(broken.reloaded, 1);
    assert.match(brokenResult.reason, /did not appear after login/);

    // 服务器统计失败时不得当成 0 台服务器
    const unreadable = stubPage({ entries: 0, text: 'You not have servers.', countThrows: true });
    assert.strictEqual((await classifyMissingRenew(unreadable)).status, 'server_entry_not_ready');

    // 统计卡片 "0\nServers"、导航项 "My servers" 不得误判为账号无服务器
    const statCard = stubPage({ entries: 0, text: 'Credits 0 Remaining credits 0\nServers My servers Order Shop' });
    assert.strictEqual((await classifyMissingRenew(statCard)).status, 'server_entry_not_ready');

    console.log('✅ server_entry tests passed');
}

tests();
