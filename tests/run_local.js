'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 LANCEMENT DE LA SUITE DE TESTS UNITAIRES (Node.js)');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Mocks pour l'environnement Google Apps Script
const context = {
    console: console,
    Date: Date,
    JSON: JSON,
    Math: Math,
    String: String,
    Array: Array,
    Object: Object,
    Set: Set,
    RegExp: RegExp,
    Number: Number,
    Boolean: Boolean,
    PropertiesService: (() => {
        const store = {
            'GEMINI_API_KEY': 'AIzaSyTestApiKeyMock12345'
        };
        const propsObj = {
            getProperty: (k) => store[k] !== undefined ? store[k] : null,
            getProperties: () => Object.assign({}, store),
            setProperty: (k, v) => { store[k] = String(v); },
            deleteProperty: (k) => { delete store[k]; }
        };
        return {
            getScriptProperties: () => propsObj,
            getUserProperties: () => propsObj
        };
    })(),
    Session: {
        getEffectiveUser: () => ({ getEmail: () => 'test@example.com' }),
        getScriptTimeZone: () => 'Europe/Paris'
    },
    GmailApp: {
        getAliases: () => [],
        getUserLabelByName: () => null,
        createLabel: () => ({}),
        search: () => [],
        getMessagesForThreads: () => [],
        sendEmail: () => {}
    },
    LockService: {
        getScriptLock: () => ({
            tryLock: () => true,
            releaseLock: () => {}
        })
    },
    ScriptApp: {
        getProjectTriggers: () => [],
        newTrigger: () => ({
            timeBased: () => ({
                everyHours: () => ({ create: () => {} }),
                everyDays: () => ({ atHour: () => ({ create: () => {} }) }),
                after: () => ({ create: () => {} })
            })
        })
    },
    Utilities: {
        sleep: () => {}
    },
    UrlFetchApp: {
        fetch: () => ({})
    }
};

vm.createContext(context);

// 2. Chargement de tous les fichiers source .gs du projet
const rootDir = path.resolve(__dirname, '..');
const sourceFiles = [
    'Config.gs',
    'Utils.gs',
    'Gemini.gs',
    'Quarantaine.gs',
    'Reset.gs',
    'Tri.gs',
    'Digest.gs',
    'Setup.gs',
    'WebApp.gs',
    'Tests.gs'
];

for (const file of sourceFiles) {
    const filePath = path.join(rootDir, file);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context, { filename: file });
}

// 3. Exécution de la suite de tests
const resultats = vm.runInContext('executerTestsUnitaires()', context);

console.log('\n───────────────────────────────────────────────────────────');
if (resultats.echecs === 0) {
    console.log(`🎉 SUCCÈS COMPLET : ${resultats.reussis}/${resultats.total} tests validés avec succès !`);
    process.exit(0);
} else {
    console.error(`💥 ÉCHEC : ${resultats.echecs} test(s) en échec sur ${resultats.total} !`);
    process.exit(1);
}
