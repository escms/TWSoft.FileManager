(function () {
    let langData = {};
    let currentLang = 'zh-CN';
    let previewExtensions = [];

    async function loadLang(locale) {
        try {
            const resp = await fetch('/api/lang/' + locale);
            if (!resp.ok) throw new Error('Failed to load language');
            langData = await resp.json();
            currentLang = locale;
            document.documentElement.lang = locale;
            translatePage();
            dispatchEvent(new CustomEvent('langchange', { detail: { lang: locale } }));
        } catch (e) {
            console.error('i18n load error:', e);
        }
    }

    function t(key, vars) {
        let text = langData[key];
        if (text === undefined) return key;
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                text = text.replace('{' + k + '}', v);
            }
        }
        return text;
    }

    function translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = t(key);
            if (text !== key) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = text;
                } else if (el.tagName === 'TITLE') {
                    el.textContent = text;
                } else {
                    el.textContent = text;
                }
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
        document.querySelectorAll('[data-i18n-value]').forEach(el => {
            el.value = t(el.getAttribute('data-i18n-value'));
        });
    }

    function initLangSwitcher(container) {
        const select = document.createElement('select');
        select.className = 'lang-switcher';
        select.innerHTML = '';
        (window.__supportedLangs || ['zh-CN', 'en']).forEach(locale => {
            const opt = document.createElement('option');
            opt.value = locale;
            opt.textContent = t('common.' + locale) || locale;
            if (locale === currentLang) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => {
            const lang = select.value;
            fetch('/api/lang', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang })
            }).then(() => loadLang(lang));
        });
        container.appendChild(select);
        addEventListener('langchange', () => {
            select.querySelectorAll('option').forEach(opt => {
                opt.textContent = t('common.' + opt.value) || opt.value;
            });
        });
    }

    function isPreviewSupported(filename) {
        if (!filename) return false;
        const ext = '.' + filename.split('.').pop().toLowerCase();
        return previewExtensions.includes(ext);
    }

    async function init() {
        try {
            const cfg = await fetch('/api/config').then(r => r.json());
            window.__supportedLangs = cfg.i18n.supportedLangs;
            previewExtensions = cfg.previewExtensions || [];
            currentLang = cfg.i18n.currentLang || cfg.i18n.defaultLang || 'zh-CN';
            await loadLang(currentLang);
        } catch (e) {
            console.error('i18n init error:', e);
        }
    }

    window.i18n = { init, t, loadLang, initLangSwitcher, translatePage, isPreviewSupported };
})();
