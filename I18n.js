// The language of the editor's words: buttons, hints, explanations, the line at the bottom. T(english, russian) gives
// the one chosen (in templates too: T is a global property of the app). The choice is kept in the browser
// (localStorage); at first, the browser's own language. Messages of the checks stay as the engine's tools say them
const I18n = Vue.reactive({
    storageKey: 'dgx-ge-sprite-editor-lang',
    languages: [
        ['en', 'English'],
        ['ru', 'Русский']
    ],
    lang: 'en',
    set(lang) {
        if (!this.languages.some(([l]) => l === lang)) return;
        this.lang = lang;
        document.documentElement.lang = lang;
        try {
            localStorage.setItem(this.storageKey, lang);
        } catch (e) {}
    },
});
(() => {
    let lang = null;
    try {
        lang = localStorage.getItem(I18n.storageKey);
    } catch (e) {}
    if (!I18n.languages.some(([l]) => l === lang)) lang = /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
    I18n.lang = lang;
    document.documentElement.lang = lang;
})();

// the text in the language chosen: english, or russian when that is chosen and given
function T(en, ru) {
    return I18n.lang === 'ru' && ru !== undefined ? ru : en;
}
