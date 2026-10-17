// 退出码与终态词表的唯一 owner。
// action_renew.js / proxy_runner.js / lib/* 都从这里取，新增终态只改这一个文件。

const EXIT_CODE = {
    SUCCESS: 0,
    FATAL: 1,
    PROXY_RETRY: 42,           // Turnstile 3次仍失败 → 外层换代理，不与其他退出码冲突
    RENEW_CAPTCHA_FAILED: 43,  // Renew ALTCHA 失败，不换代理但也不返回成功
    NOT_READY: 3,              // 还没到续期窗口
    ALREADY_RENEWED: 4,        // Expiry 未变化，本轮已是最新
    LOGIN_FAILED: 5,           // 账号或密码错误
    NO_PROXY_AVAILABLE: 6      // 全部代理冷却，暂无可用代理（只有 proxy_runner 会产生）
};

// mergeExitCode 的严重度序，必须覆盖 EXIT_CODE 的每个值
const EXIT_CODE_PRIORITY = [EXIT_CODE.FATAL, EXIT_CODE.PROXY_RETRY, EXIT_CODE.LOGIN_FAILED, EXIT_CODE.NO_PROXY_AVAILABLE, EXIT_CODE.RENEW_CAPTCHA_FAILED, EXIT_CODE.NOT_READY, EXIT_CODE.ALREADY_RENEWED, EXIT_CODE.SUCCESS];

const SUCCESS_STATUSES = ['success', 'already_renewed'];
const OK_STATUSES = [...SUCCESS_STATUSES, 'not_ready', 'no_servers'];

const STATUS_TITLES = {
    success: '✅ KataBump 自动续期完成',
    not_ready: '⏳ KataBump 本轮暂不可续期',
    no_servers: '⚠️ KataBump 账号下没有服务器（可能已全部删除或停用）',
    already_renewed: 'ℹ️ KataBump 已续期或无需重复续期',
    captcha_required: '⚠️ KataBump 续期验证码阻断',
    login_captcha_required: '⚠️ KataBump 登录验证码阻断',
    login_failed: '❌ KataBump 登录失败',
    server_entry_not_ready: '❌ KataBump 服务器入口/Renew 按钮未就绪',
    no_proxy_available: '❌ KataBump 无可用代理',
    proxy_exhausted: '❌ KataBump 代理已耗尽',
    proxy_retry: '❌ KataBump 代理重试失败',
    error: '❌ KataBump 自动续期失败'
};

// 一个退出码可能对应多个终态名（FATAL→error/server_entry_not_ready，NOT_READY→not_ready/no_servers）
const STATUSES_BY_EXIT_CODE = {
    [EXIT_CODE.SUCCESS]: ['success'],
    [EXIT_CODE.NOT_READY]: ['not_ready', 'no_servers'],
    [EXIT_CODE.ALREADY_RENEWED]: ['already_renewed'],
    [EXIT_CODE.LOGIN_FAILED]: ['login_failed'],
    [EXIT_CODE.RENEW_CAPTCHA_FAILED]: ['captcha_required'],
    [EXIT_CODE.PROXY_RETRY]: ['login_captcha_required'],
    [EXIT_CODE.FATAL]: ['error', 'server_entry_not_ready']
};

module.exports = {
    EXIT_CODE,
    EXIT_CODE_PRIORITY,
    SUCCESS_STATUSES,
    OK_STATUSES,
    STATUS_TITLES,
    STATUSES_BY_EXIT_CODE
};
