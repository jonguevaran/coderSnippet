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

async function loadCurrentConfig() {
    const config = await window.api.readAppConfig();
    inputAuthor.value = config?.autor || '';
    inputDbDirectory.value = config?.bdDirectory || '';
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
        bdDirectory: inputDbDirectory.value.trim()
    };

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

loadCurrentConfig();
