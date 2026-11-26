const path = require('path');
const { pathToFileURL } = require('url');

const sdk = (file) => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'renderer', 'sdk', file)).href);

async function createFakeBm({ call, scope, channels = null, configs = {}, language = null, extra = {} }) {
    const { Translator } = await sdk('Translator.js');
    const { BmClock } = await sdk('BmClock.js');
    if (language) {
        await call('settings:set', { key: 'language', value: language });
    }
    const i18n = new Translator(await call('i18n:bundle', { scope }));
    const allows = (channel) => {
        if (channels === null) {
            return true;
        }
        const [domain] = channel.split(':');
        return channels.includes(channel) || channels.includes(`${domain}:*`);
    };
    const denied = [];
    const bm = {
        i18n,
        denied,
        t: (key, params) => i18n.t(key, params),
        language: i18n.language,
        locale: i18n.locale,
        config: async (name) => (name in configs ? configs[name] : call('config:get', { name })),
        invoke: async (channel, payload) => {
            if (!allows(channel)) {
                denied.push(channel);
                throw Object.assign(new Error(`Модулю запрещён канал: ${channel}`), { status: 403 });
            }
            return call(channel, payload);
        },
        clock: new BmClock(),
        storage: {},
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { name: 'dark', chart: { text: '#aaa', grid: '#333' }, variables: {} },
        ...extra
    };
    return bm;
}

module.exports = { createFakeBm };
