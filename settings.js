// Sincronizar tema con la ventana principal
(function initTheme() {
    const saved = localStorage.getItem('app-theme') || 'dark';
    if (saved === 'light') document.body.setAttribute('data-theme', 'light');
})();

const settingsForm = document.getElementById('settings-form');
const inputAuthor = document.getElementById('author-input');
const inputDbDirectory = document.getElementById('db-directory-input');
const btnChooseDirectory = document.getElementById('btn-choose-directory');
const btnCancel = document.getElementById('btn-cancel');
const checkShowDeleted = document.getElementById('check-show-deleted');
const selectLanguage = document.getElementById('select-language');

// Cargar estado previo del checkbox
if (checkShowDeleted) {
    checkShowDeleted.checked = localStorage.getItem('show-deleted-notes') === 'true';
}

async function loadCurrentConfig() {
    const config = await window.api.readAppConfig();
    inputAuthor.value = config?.autor || '';
    inputDbDirectory.value = config?.bdDirectory || '';
    if (selectLanguage) selectLanguage.value = config?.idioma || 'es';
    applyLanguage(config?.idioma || 'es');
}

btnChooseDirectory.addEventListener('click', async () => {
    const result = await window.api.selectDirectory();
    if (!result.canceled && result.path) {
        inputDbDirectory.value = result.path;
    }
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const configToSave = {
        autor: inputAuthor.value.trim(),
        bdDirectory: inputDbDirectory.value.trim(),
        idioma: selectLanguage ? selectLanguage.value : 'es'
    };

    // Guardar estado del checkbox en localStorage
    if (checkShowDeleted) {
        localStorage.setItem('show-deleted-notes', checkShowDeleted.checked ? 'true' : 'false');
    }

    const result = await window.api.writeAppConfig(configToSave);
    if (!result.success) {
        alert('No se pudo guardar la configuracion: ' + result.error);
        return;
    }

    alert('Configuracion guardada correctamente.');
    window.close();
});

btnCancel.addEventListener('click', () => {
    window.close();
});

function applyLanguage(lang) {
    if (!window.getTranslation) return;
    document.title = window.getTranslation(lang, 'settings_title');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = window.getTranslation(lang, key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = translation;
        } else {
            // Preservar hijos como SVG si existen
            const svg = el.querySelector('svg');
            const i = el.querySelector('i');
            if (svg || i) {
                // Si tiene icono, solo reemplazar el texto (asumiendo que está al final o envuelto)
                // Para simplificar, si tiene icono, solemos tener un span o texto suelto.
                // Pero en settings.html no tienen iconos los botones.
                el.innerText = translation;
            } else {
                el.innerText = translation;
            }
        }
    });
}

if (selectLanguage) {
    selectLanguage.addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });
}

loadCurrentConfig();

// Abrir Guía de Inicio (Leeme)
const btnReadme = document.getElementById('btn-readme');
if (btnReadme) {
    btnReadme.addEventListener('click', () => {
        if (window.api && window.api.openReadme) {
            window.api.openReadme();
        }
    });
}
