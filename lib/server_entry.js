// Dashboard 的服务器列表由 /api-client/list-servers 异步填充，
// 服务器入口 a[href*="/servers/edit?id="] 是服务器是否就绪的权威判据，Renew 只存在于详情页。
// “找不到 Renew” 的两条路径（登录后的 See 入口、续期循环里按钮消失）共用这里的分类，
// 直接返回终态 status，避免调用方各自翻译出不同状态名。

const SEE_ENTRY_SELECTOR = 'a[href*="/servers/edit?id="]';
// 仅匹配 KataBump 的服务器空态文案；措辞取自真实 dashboard 快照
// (actions/runs/39000012720 → screenshots/login_after_submit_*.html: "You not have servers.")。
// 不放宽到 /no servers/ 或 /0 servers/，统计卡片 "0\nServers" 与导航项会误命中。
const NO_SERVERS_PATTERN = /you (not|don'?t|do not) have (any )?servers/i;

function renewButton(page) {
    return page.getByRole('button', { name: 'Renew', exact: true }).first();
}

async function pageText(page) {
    try {
        return (await page.evaluate(() => (document.body ? document.body.innerText : ''))) || '';
    } catch {
        return '';
    }
}

async function countServerEntries(page) {
    try {
        return await page.locator(SEE_ENTRY_SELECTOR).count();
    } catch {
        return -1; // 统计失败不能当成 0 台服务器
    }
}

// 只有页面明确显示“没有服务器”才返回 no_servers，否则一律算识别失败。
// status 就是 action_renew.js 的终态名，调用方只做 runStatus = status。
// no_servers 与 not_ready（续期窗口未开）语义相反：前者不会自愈，所以必须是两个终态名。
async function classifyMissingRenew(page) {
    const entries = await countServerEntries(page);
    if (entries === 0 && NO_SERVERS_PATTERN.test(await pageText(page))) {
        return { ready: false, status: 'no_servers', reason: 'KataBump 账号下没有任何服务器（Dashboard 显示无可用服务器），本轮无可续期目标' };
    }
    return { ready: false, status: 'server_entry_not_ready', reason: 'Renew 按钮未出现在服务器列表或详情页' };
}

// 等服务器列表就绪 → 点 See → 等 Renew 出现；一次失败后刷新 Dashboard 重试。
// 返回 { ready, status, reason }，status ∈ ready | no_servers | server_entry_not_ready。
async function resolveServerEntry(page, { logger = console, waitMs = 20000, renewWaitMs = 15000 } = {}) {
    let lastError = null;

    for (let pass = 1; pass <= 2; pass++) {
        try {
            const seeBtn = page.locator(SEE_ENTRY_SELECTOR).first();
            await seeBtn.waitFor({ state: 'visible', timeout: waitMs });
            const href = await seeBtn.getAttribute('href');
            logger.log(`[登录] 服务器入口已加载: ${href || 'unknown'}`);
            await Promise.all([
                page.waitForURL(url => /\/servers\/edit\?id=/i.test(url), { timeout: 15000 }),
                seeBtn.click()
            ]);
            logger.log(`[登录] 已点击 See 按钮，当前 URL: ${page.url()}`);
            await renewButton(page).waitFor({ state: 'visible', timeout: renewWaitMs });
            logger.log('[登录] 已进入服务器详情页，Renew 按钮已出现。');
            return { ready: true, status: 'ready', reason: '' };
        } catch (error) {
            lastError = error;
            const missing = await classifyMissingRenew(page);
            if (missing.status === 'no_servers') return missing;
            if (pass === 1) {
                logger.warn(`[登录] See 入口尚未出现，刷新 Dashboard 后重试: ${error.message}`);
                try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); } catch { }
            }
        }
    }

    const missing = await classifyMissingRenew(page);
    if (missing.status === 'no_servers') return missing;
    return { ...missing, reason: `Server See entry or Renew button did not appear after login: ${lastError ? lastError.message : 'unknown error'}` };
}

module.exports = {
    SEE_ENTRY_SELECTOR,
    renewButton,
    classifyMissingRenew,
    resolveServerEntry
};
