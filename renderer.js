// === TEMA: Inicializar ANTES de renderizar para evitar parpadeo ===
(function initTheme() {
    const saved = localStorage.getItem('app-theme') || 'dark';
    if (saved === 'light') {
        document.body.setAttribute('data-theme', 'light');
    }
})();

// Estado de la aplicación
// Estado de la aplicación
let snippets = [];
let lenguajes = [];
let currentSnippetId = null;
let currentFolder = null;
let appConfig = { autor: '' };
let hasPendingChanges = false;

// Elementos del DOM (Navegación / Vistas)
const foldersView = document.getElementById('folders-view');
const snippetsView = document.getElementById('snippets-view');
const folderList = document.getElementById('folder-list');
const btnManageLanguages = document.getElementById('btn-manage-languages');
const searchFolderInput = document.getElementById('search-folder-input');

// Modal Elements
const languageModal = document.getElementById('language-modal');
const btnCloseLangModal = document.getElementById('btn-close-lang-modal');
const modalNewLangInput = document.getElementById('modal-new-lang-input');
const btnModalAddLang = document.getElementById('btn-modal-add-lang');
const modalLanguageList = document.getElementById('modal-language-list');
const btnBackFolders = document.getElementById('btn-back-folders');
const currentFolderName = document.getElementById('current-folder-name');

const searchInput = document.getElementById('search-input');
const snippetList = document.getElementById('snippet-list');
const snippetForm = document.getElementById('snippet-form');

const inputId = document.getElementById('snippet-id');
const inputTitle = document.getElementById('snippet-title');
const inputPurpose = document.getElementById('snippet-purpose');
const inputAuthor = document.getElementById('snippet-author');
const inputLanguage = document.getElementById('snippet-language');
const inputCode = document.getElementById('snippet-code');
const datalistLanguage = document.getElementById('language-list');

const btnRefresh = document.getElementById('btn-refresh');
const btnNew = document.getElementById('btn-new');
const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');
const btnCancel = document.getElementById('btn-cancel');
const btnRestore = document.getElementById('btn-restore');
const btnSettings = document.getElementById('btn-settings');

// Botón Copiar y Editor
const btnCopy = document.getElementById('btn-copy');
const lineNumbersDiv = document.getElementById('line-numbers');

// Inicialización
async function init() {
    await loadDataFromDisk();
    await loadAppConfig();
    initUnsavedChangesTracking();
    
    renderLanguages();
    switchView('folders');
    resetForm();
}

async function loadDataFromDisk() {
    lenguajes = await window.api.readData('lenguajes');
    snippets = await window.api.readData('snippets');
}

async function loadAppConfig() {
    const config = await window.api.readAppConfig();
    appConfig = config && typeof config === 'object' ? config : { autor: '', idioma: 'es' };
    if (typeof applyLanguage === 'function') {
        applyLanguage(appConfig.idioma || 'es');
    }

    if (appConfig._configMigrated) {
        const langCode = appConfig.idioma || 'es';
        const msg = window.getTranslation
            ? window.getTranslation(langCode, 'toast_config_migrated')
            : 'Se conservó tu configuración después de la actualización.';
        showToast(msg, 'success');
    }
}

async function refreshFormData(showMessage = false) {
    const previousFolder = currentFolder;
    const previousSearch = searchInput.value;

    await loadDataFromDisk();
    await loadAppConfig();
    renderLanguages();

    const folderStillExists = lenguajes.some(
        l => l.Activo && previousFolder && l.Nombre.toLowerCase() === previousFolder.toLowerCase()
    );

    if (folderStillExists) {
        switchView('snippets', previousFolder);
        searchInput.value = previousSearch;
        renderSnippets(previousSearch);
    } else {
        switchView('folders');
    }

    resetForm();

    if (showMessage) {
        showToast('Datos del formulario recargados.', 'success');
    }
}

// Custom Toast para evitar bugs de perdida de focus en inputs que causan los alert() nativos de Electron
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.color = 'white';
    toast.style.backgroundColor = type === 'success' ? '#2e7d32' : '#d32f2f'; // Verde más oscuro o rojo
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    toast.style.fontSize = '14px';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.textContent = message;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Remover tras 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Cambiar entre vista de carpetas y de snippets
function switchView(view, folderName = null) {
    if (view === 'folders') {
        foldersView.style.display = 'flex';
        snippetsView.style.display = 'none';
        currentFolder = null;
        if(searchFolderInput) searchFolderInput.value = '';
        renderFolders();
    } else {
        foldersView.style.display = 'none';
        snippetsView.style.display = 'flex';
        currentFolder = folderName;
        currentFolderName.textContent = folderName;
        searchInput.value = '';
        renderSnippets();
    }
}

// Renderizar Carpetas (Lenguajes)
function renderFolders(searchFolderTerm = '') {
    folderList.innerHTML = '';
    const activeLangs = lenguajes.filter(l => l.Activo);
    const showDeleted = localStorage.getItem('show-deleted-notes') === 'true';
    
    // Contar snippets activos por lenguaje
    const counts = {};
    snippets.filter(s => s.Activo).forEach(s => {
        counts[s.Lenguaje] = (counts[s.Lenguaje] || 0) + 1;
    });

    let filteredLangs = activeLangs;
    if (searchFolderTerm) {
        const normalizedSearch = normalizeString(searchFolderTerm);
        const terms = normalizedSearch.split(/\s+/).filter(Boolean);
        filteredLangs = activeLangs.filter(l => {
            const normalizedName = normalizeString(l.Nombre);
            return terms.every(term => normalizedName.includes(term));
        });
    }

    filteredLangs.sort((a,b) => a.Nombre.localeCompare(b.Nombre)).forEach(lang => {
        const count = counts[lang.Nombre] || 0;
        const div = document.createElement('div');
        div.className = 'folder-item';
        
        if (lang.Color) {
            div.style.setProperty('--folder-bg', lang.Color);
            // Calcular brillo para contrastar texto
            const r = parseInt(lang.Color.substr(1,2), 16);
            const g = parseInt(lang.Color.substr(3,2), 16);
            const b = parseInt(lang.Color.substr(5,2), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            div.style.color = brightness > 125 ? '#1e1e1e' : '#ffffff';
            div.style.backgroundColor = 'var(--folder-bg)';
        }
        
        div.innerHTML = `
            <div class="folder-info">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <span>${lang.Nombre}</span>
                <span class="folder-count">${count}</span>
            </div>
            <button class="btn-delete-folder" title="Eliminar Carpeta">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        
        // Evento eliminar
        const delBtn = div.querySelector('.btn-delete-folder');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFolder(lang.ID);
        });

        // Evento entrar a carpeta
        div.addEventListener('click', async () => {
            await withUnsavedChangesGuard(async () => {
                switchView('snippets', lang.Nombre);
                resetForm();
            });
        });
        
        folderList.appendChild(div);
    });

    if (showDeleted) {
        const deletedCount = snippets.filter(s => s.Activo === false).length;
        const div = document.createElement('div');
        div.className = 'folder-item virtual-folder';
        div.style.borderLeft = '3px solid #f44336';
        div.innerHTML = `
            <div class="folder-info">
                <i class="ri-delete-bin-line" style="margin-right: 8px; color: #f44336;"></i>
                <span>Eliminados</span>
                <span class="folder-count" style="background: #f44336; color: white;">${deletedCount}</span>
            </div>
        `;
        div.addEventListener('click', async () => {
            await withUnsavedChangesGuard(async () => {
                switchView('snippets', 'Eliminados');
                resetForm();
            });
        });
        folderList.appendChild(div);
    }
}

// Eliminar Carpeta
async function deleteFolder(id) {
    const langCode = appConfig.idioma || 'es';
    const msg = window.getTranslation ? window.getTranslation(langCode, 'confirm_delete_folder') : "¿Estás seguro de eliminar este cuaderno? Sus notas no serán borradas físicamente pero desaparecerá de la lista.";
    if (confirm(msg)) {
        const lang = lenguajes.find(l => l.ID === id);
        if (lang) {
            lang.Activo = false;
            await window.api.writeData('lenguajes', lenguajes);
            renderLanguages();
            renderFolders();
        }
    }
}

// Modal Gestor de Lenguajes
btnManageLanguages.addEventListener('click', (e) => {
    e.preventDefault();
    renderLanguageModalList();
    languageModal.style.display = 'flex';
    modalNewLangInput.focus();
});

btnCloseLangModal.addEventListener('click', () => {
    languageModal.style.display = 'none';
    renderLanguages();
    renderFolders();
});

window.addEventListener('click', (e) => {
    if (e.target === languageModal) {
        btnCloseLangModal.click();
    }
});

// Renderizar Lista en Modal
function renderLanguageModalList() {
    modalLanguageList.innerHTML = '';
    
    // Mostrar TODOS los lenguajes, sin filtrar por Activo
    lenguajes.sort((a,b) => a.Nombre.localeCompare(b.Nombre)).forEach(lang => {
        const tr = document.createElement('tr');
        const isActive = lang.Activo !== false; // True por defecto si es undefined
        
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="color-indicator" style="width: 12px; height: 12px; border-radius: 50%; background-color: ${lang.Color || '#1e1e1e'}; border: 1px solid var(--panel-border);"></span>
                    <span class="lang-name-display">${lang.Nombre}</span>
                    <input type="text" class="lang-name-edit" value="${lang.Nombre}" style="display: none; flex-grow: 1; padding: 4px; background: var(--input-bg); border: 1px solid var(--accent-color); color: var(--text-primary); outline: none;">
                    <input type="color" class="lang-color-edit" value="${lang.Color || '#1e1e1e'}" style="display: none; width: 24px; height: 24px; padding: 0; border: none; border-radius: 50%; cursor: pointer;" title="Color del cuaderno">
                    <input type="text" class="lang-color-edit-hex" value="${(lang.Color || '#1e1e1e').toUpperCase()}" style="display: none; width: 68px; padding: 3px 4px; font-size: 11px; font-family: monospace; text-transform: uppercase; background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); border-radius: 3px;" maxlength="7" placeholder="#FFFFFF">
                </div>
            </td>
            <td><span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Activo' : 'Inactivo'}</span></td>
            <td>
                <div class="action-links">
                    <button class="action-link edit btn-edit-lang">Editar</button>
                    <button class="action-link edit btn-save-lang" style="display: none;">Guardar</button>
                    <button class="action-link toggle btn-toggle-lang">${isActive ? 'Desactivar' : 'Activar'}</button>
                </div>
            </td>
        `;

        const btnEdit = tr.querySelector('.btn-edit-lang');
        const btnSave = tr.querySelector('.btn-save-lang');
        const btnToggle = tr.querySelector('.btn-toggle-lang');
        const nameDisplay = tr.querySelector('.lang-name-display');
        const nameEdit = tr.querySelector('.lang-name-edit');

        btnEdit.addEventListener('click', () => {
            nameDisplay.style.display = 'none';
            nameEdit.style.display = 'block';
            const colorEdit = tr.querySelector('.lang-color-edit');
            const colorEditHex = tr.querySelector('.lang-color-edit-hex');
            if (colorEdit) colorEdit.style.display = 'inline-block';
            if (colorEditHex) colorEditHex.style.display = 'inline-block';
            btnEdit.style.display = 'none';
            btnSave.style.display = 'inline-block';
            nameEdit.focus();
        });

        // Guardar edición
        btnSave.addEventListener('click', async () => {
            const newName = nameEdit.value.trim();
            const formattedName = newName.charAt(0).toUpperCase() + newName.slice(1);
            if (formattedName) {
                const exists = lenguajes.find(l => l.Nombre.toLowerCase() === formattedName.toLowerCase() && l.ID !== lang.ID);
                if (exists) {
                    showToast('Ese nombre ya está en uso.', 'error');
                    return;
                }
                
                // Actualizar snippets que tenían este lenguaje si el nombre cambió
                const oldName = lang.Nombre;
                if (formattedName !== oldName) {
                    snippets.forEach(s => {
                        if (s.Lenguaje === oldName) s.Lenguaje = formattedName;
                    });
                    await window.api.writeData('snippets', snippets);
                }

                const colorEdit = tr.querySelector('.lang-color-edit');
                const colorEditHex = tr.querySelector('.lang-color-edit-hex');
                let newColor = colorEdit ? colorEdit.value : lang.Color;
                if (colorEditHex && /^#[0-9A-F]{6}$/i.test(colorEditHex.value)) {
                    newColor = colorEditHex.value;
                }

                lang.Nombre = formattedName;
                lang.Codigo = formattedName.toLowerCase();
                lang.Color = newColor; // Guardar color
                await window.api.writeData('lenguajes', lenguajes);
            }
            renderLanguageModalList();
        });

        // Toggle Activo
        btnToggle.addEventListener('click', async () => {
            lang.Activo = !isActive;
            await window.api.writeData('lenguajes', lenguajes);
            renderLanguageModalList();
        });

        // Sincronizar selectores de color en edición
        const colorEdit = tr.querySelector('.lang-color-edit');
        const colorEditHex = tr.querySelector('.lang-color-edit-hex');
        if (colorEdit && colorEditHex) {
            colorEdit.addEventListener('input', (e) => {
                colorEditHex.value = e.target.value.toUpperCase();
            });
            colorEditHex.addEventListener('input', (e) => {
                const val = e.target.value;
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    colorEdit.value = val;
                }
            });
        }

        modalLanguageList.appendChild(tr);
    });
}

// Agregar Lenguaje desde Modal
btnModalAddLang.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = modalNewLangInput.value.trim();
    if (!name) return;
    
    const colorInput = document.getElementById('modal-new-lang-color');
    const colorInputHex = document.getElementById('modal-new-lang-color-hex');
    let color = colorInput ? colorInput.value : '#1e1e1e';
    if (colorInputHex && /^#[0-9A-F]{6}$/i.test(colorInputHex.value.trim())) {
        color = colorInputHex.value.trim();
    }

    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    const exists = lenguajes.find(l => l.Nombre.toLowerCase() === formattedName.toLowerCase());
    if (exists) {
        if (!exists.Activo) {
            exists.Activo = true;
        } else {
            showToast('¡Este cuaderno ya existe y está activo!', 'error');
            return;
        }
    } else {
        const newId = lenguajes.length > 0 ? Math.max(...lenguajes.map(l => l.ID)) + 1 : 1;
        lenguajes.push({ ID: newId, Nombre: formattedName, Codigo: formattedName.toLowerCase(), Activo: true, Color: color });
    }
    
    const result = await window.api.writeData('lenguajes', lenguajes);
    if(result.success) {
        modalNewLangInput.value = '';
        renderLanguageModalList();
        renderLanguages();
        renderFolders();
    } else {
        showToast("Error al guardar cuaderno", 'error');
    }
});

modalNewLangInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        btnModalAddLang.click();
    }
});

// Renderizar lista de lenguajes en Datalist (Mantenemos solo el Nombre ahora)
function renderLanguages() {
    datalistLanguage.innerHTML = '';
    lenguajes
        .filter(l => l.Activo)
        .sort((a, b) => a.Nombre.localeCompare(b.Nombre))
        .forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.Nombre;
            datalistLanguage.appendChild(option);
        });
}

// Función auxiliar para normalizar cadenas (quitar acentos y pasar a minúsculas)
function normalizeString(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function hasUnsavedChanges() {
    return hasPendingChanges;
}

function markCurrentStateAsSaved() {
    hasPendingChanges = false;
}

function initUnsavedChangesTracking() {
    const markDirty = () => {
        hasPendingChanges = true;
    };

    const trackedInputs = [inputTitle, inputPurpose, inputAuthor, inputLanguage];
    trackedInputs.forEach((el) => {
        if (!el) return;
        el.addEventListener('input', markDirty);
        el.addEventListener('change', markDirty);
    });

    if (inputCode) {
        inputCode.addEventListener('input', markDirty);
    }
}

async function withUnsavedChangesGuard(action) {
    if (!hasUnsavedChanges()) {
        await action();
        return;
    }

    const langCode = appConfig.idioma || 'es';
    const msg = window.getTranslation
        ? window.getTranslation(langCode, 'confirm_apply_changes')
        : 'Desea aplicar cambios?';

    if (confirm(msg)) {
        const saved = await saveSnippet();
        if (!saved) {
            const discard = confirm('No se pudo guardar. ¿Desea continuar sin guardar?');
            if (!discard) return;
        }
    }

    await action();
}

// Renderizar Snippets en el Panel Izquierdo (por carpeta actual)
function renderSnippets(searchTerm = '') {
    snippetList.innerHTML = '';
    
    const filtered = snippets.filter(s => {
        if (currentFolder === 'Eliminados') {
            if (s.Activo !== false) return false;
        } else {
            if (!s.Activo) return false;
            if (currentFolder && s.Lenguaje.toLowerCase() !== currentFolder.toLowerCase()) return false;
        }
        
        if (searchTerm) {
            const normalizedSearch = normalizeString(searchTerm);
            const terms = normalizedSearch.split(/\s+/).filter(Boolean);
            
            const normalizedTitle = normalizeString(s.Titulo);
            const normalizedPurpose = normalizeString(s.Proposito);
            const normalizedCode = normalizeString(s.Codigo);

            return terms.every(term => 
                normalizedTitle.includes(term) ||
                normalizedPurpose.includes(term) ||
                normalizedCode.includes(term)
            );
        }
        return true;
    });

    filtered.sort((a, b) => a.Titulo.localeCompare(b.Titulo)).forEach(snippet => {
        const div = document.createElement('div');
        div.className = `snippet-item ${currentSnippetId === snippet.ID ? 'active' : ''}`;
        div.onclick = async () => {
            await withUnsavedChangesGuard(async () => {
                await selectSnippet(snippet.ID);
            });
        };
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'snippet-item-title';
        titleDiv.textContent = snippet.Titulo;
        
        const langDiv = document.createElement('div');
        langDiv.className = 'snippet-item-lang';
        langDiv.textContent = snippet.Lenguaje;

        div.appendChild(titleDiv);
        div.appendChild(langDiv);
        
        snippetList.appendChild(div);
    });
}

// Seleccionar un Snippet
async function selectSnippet(id) {
    const snippet = snippets.find(s => s.ID === id);
    if (!snippet) return;

    currentSnippetId = snippet.ID;
    inputId.value = snippet.ID;
    inputTitle.value = snippet.Titulo;
    if (inputPurpose) inputPurpose.value = snippet.Proposito;
    inputAuthor.value = snippet.Autor || appConfig.autor || '';
    if (inputLanguage) inputLanguage.value = snippet.Lenguaje;

    // Cargar contenido enriquecido con portabilidad
    const mediaDirUrl = await window.api.getMediaUrl('');
    let content = snippet.Codigo || '';
    if (mediaDirUrl) {
        content = content.replace(/##MEDIA_DIR##\//g, mediaDirUrl);
    }
    inputCode.innerHTML = content;

    const isDeleted = snippet.Activo === false;
    btnDelete.style.display = isDeleted ? 'none' : 'block';
    if (btnRestore) btnRestore.style.display = isDeleted ? 'block' : 'none';
    
    renderSnippets(searchInput.value);
    markCurrentStateAsSaved();
}

// Funcionalidad "Nuevo" / "Cancelar"
function resetForm() {
    currentSnippetId = null;
    
    inputId.value = '';
    inputTitle.value = '';
    if (inputPurpose) inputPurpose.value = '';
    inputAuthor.value = appConfig.autor || '';
    if (inputLanguage) inputLanguage.value = currentFolder || ''; // Prellenar con la carpeta actual si estamos en una
    inputCode.innerHTML = ''; // Limpiar div

    btnDelete.style.display = 'none';
    inputTitle.focus();
    
    if (snippetsView.style.display !== 'none') {
        renderSnippets(searchInput.value);
    }

    markCurrentStateAsSaved();
}

// Procesar el lenguaje ingresado (Simplificado)
function formatLanguage(userInput) {
    const term = userInput.trim().toLowerCase();
    const match = lenguajes.find(l => l.Nombre.toLowerCase() === term || (l.Codigo && l.Codigo.toLowerCase() === term));
    
    if (match) return match.Nombre;
    
    return userInput.charAt(0).toUpperCase() + userInput.slice(1);
}

// Guardar
async function saveSnippet() {
    if (!snippetForm.checkValidity()) {
        snippetForm.reportValidity();
        return false;
    }

    const title = inputTitle.value.trim().toUpperCase();
    let purpose = inputPurpose && typeof inputPurpose.value === 'string' ? inputPurpose.value.trim() : '';
    if (!purpose) {
        purpose = title;
        if (inputPurpose) inputPurpose.value = purpose;
    }
    const author = inputAuthor.value.trim() || appConfig.autor || '';
    const rawLanguage = inputLanguage && typeof inputLanguage.value === 'string'
        ? inputLanguage.value.trim()
        : (currentFolder || 'General');
    const formattedLanguage = formatLanguage(rawLanguage);
    
    // Convertir rutas absolutas a portables antes de guardar
    const codeHtml = inputCode.innerHTML;
    const mediaDirUrl = await window.api.getMediaUrl('');
    let portableCode = codeHtml;
    
    if (mediaDirUrl) {
        // Escapar caracteres especiales para la expresión regular de la URL
        const regex = new RegExp(mediaDirUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        portableCode = codeHtml.replace(regex, '##MEDIA_DIR##/');
    }

    if (currentSnippetId) {
        const index = snippets.findIndex(s => s.ID === currentSnippetId);
        if (index !== -1) {
            snippets[index] = { ...snippets[index], Titulo: title, Proposito: purpose, Autor: author, Lenguaje: formattedLanguage, Codigo: portableCode };
        }
    } else {
        const newId = snippets.length > 0 ? Math.max(...snippets.map(s => s.ID)) + 1 : 1;
        snippets.push({ ID: newId, Titulo: title, Proposito: purpose, Autor: author, Lenguaje: formattedLanguage, Codigo: portableCode, Activo: true });
        currentSnippetId = newId;
    }

    const result = await window.api.writeData('snippets', snippets);
    if (result.success) {
        inputTitle.value = title;
        if (inputPurpose) inputPurpose.value = purpose;
        inputAuthor.value = author;
        if (inputLanguage) inputLanguage.value = formattedLanguage;
        btnDelete.style.display = 'block';
        
        // Si el lenguaje guardado es distinto a la carpeta actual, volvemos a renderizar carpetas para actualizar conteo
        renderFolders();
        if (snippetsView.style.display !== 'none') {
            renderSnippets(searchInput.value);
        }
        markCurrentStateAsSaved();
        showToast("¡Nota guardada con éxito!", 'success');
        return true;
    } else {
        showToast("Error al guardar: " + result.error, 'error');
        return false;
    }
}

// Eliminar
async function deleteSnippet() {
    if (!currentSnippetId) return;
    const langCode = appConfig.idioma || 'es';
    const msg = window.getTranslation ? window.getTranslation(langCode, 'confirm_delete_note') : "¿Estás seguro de eliminar esta nota?";
    if (confirm(msg)) {
        const index = snippets.findIndex(s => s.ID === currentSnippetId);
        if (index !== -1) {
            snippets[index].Activo = false;
            const result = await window.api.writeData('snippets', snippets);
            if (result.success) {
                renderFolders(); // Refrescar conteos
                resetForm();
            } else {
                showToast("Error al eliminar: " + result.error, 'error');
            }
        }
    }
}

// Restaurar Nota
if (btnRestore) {
    btnRestore.addEventListener('click', async () => {
        if (!currentSnippetId) return;
        const index = snippets.findIndex(s => s.ID === currentSnippetId);
        if (index !== -1) {
            snippets[index].Activo = true;
            const result = await window.api.writeData('snippets', snippets);
            if (result.success) {
                showToast("¡Nota restaurada con éxito!", 'success');
                renderFolders(); // Refrescar conteos
                selectSnippet(currentSnippetId); // Actualizar barra de edición
            } else {
                showToast("Error al restaurar: " + result.error, 'error');
            }
        }
    });
}

// Función para insertar HTML en la posición del cursor de forma segura
function insertHTMLAtCursor(html) {
    let sel, range;
    if (window.getSelection) {
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();
            let el = document.createElement("div");
            el.innerHTML = html;
            let frag = document.createDocumentFragment(), node, lastNode;
            while ( (node = el.firstChild) ) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
}

// Interceptar Peggy de Imagenes en el editor contenteditable
inputCode.addEventListener('paste', async (e) => {
    const types = e.clipboardData ? e.clipboardData.types : [];
    
    // Si viene contenido HTML rico, sanitarizar antes de insertar para mantener coherencia
    if (types.includes('text/html')) {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Eliminar font-size e inline font-family para que herede las clases CSS
        tempDiv.querySelectorAll('[style]').forEach(el => {
            el.style.fontSize = ''; 
            el.style.fontFamily = ''; 
        });
        
        document.execCommand('insertHTML', false, tempDiv.innerHTML);
        return;
    }

    if (types.includes('text/rtf')) {
        return; 
    }

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // Prevenir pegado por defecto del clipboard
            const blob = item.getAsFile();
            const arrayBuffer = await blob.arrayBuffer();
            
            // Determinar extensión
            let ext = '.png';
            if (item.type === 'image/jpeg') ext = '.jpg';
            if (item.type === 'image/gif') ext = '.gif';

            const result = await window.api.saveMediaBuffer(arrayBuffer, ext);
            if (result.success) {
                const url = await window.api.getMediaUrl(result.fileName);
                if (url) {
                    insertHTMLAtCursor(`<img src="${url}" class="note-inline-image" draggable="false">`);
                }
            } else {
                showToast('Error pegando imagen: ' + result.error, 'error');
            }
        }
    }
});

btnCopy.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!inputCode.innerText) return;
    try {
        await navigator.clipboard.writeText(inputCode.innerText);
        const originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="#4ade80" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        btnCopy.style.borderColor = '#4ade80';
        setTimeout(() => { btnCopy.innerHTML = originalHtml; btnCopy.style.borderColor = ''; }, 1500);
    } catch (err) { console.error('Error copiando: ', err); }
});

// Event Listeners Base
btnNew.addEventListener('click', async (e) => {
    e.preventDefault();
    await withUnsavedChangesGuard(async () => {
        resetForm();
    });
});
btnRefresh.addEventListener('click', async (e) => {
    e.preventDefault();
    await refreshFormData(true);
});
btnSave.addEventListener('click', (e) => { e.preventDefault(); saveSnippet(); });
btnDelete.addEventListener('click', (e) => { e.preventDefault(); deleteSnippet(); });
btnCancel.addEventListener('click', async (e) => {
    e.preventDefault();
    await withUnsavedChangesGuard(async () => {
        resetForm();
    });
});

// --- FUNCIONALIDAD BARRA DE HERRAMIENTAS (RICH TEXT) ---
const btnBold = document.getElementById('btn-bold');
const btnH2 = document.getElementById('btn-h2');
const btnH3 = document.getElementById('btn-h3');
const btnP = document.getElementById('btn-p');
const selectFontSize = document.getElementById('select-font-size');
const inputForeColor = document.getElementById('input-forecolor');
const btnLink = document.getElementById('btn-link');

if (btnBold) {
    btnBold.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevenir pérdida de foco
        document.execCommand('bold', false, null);
    });
}

if (btnH2) {
    btnH2.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<h1>');
        if (selectFontSize) selectFontSize.value = '5'; // Título - H1
    });
}

if (btnH3) {
    btnH3.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<h2>');
        if (selectFontSize) selectFontSize.value = '4'; // Sub Título - H2
    });
}

if (btnP) {
    btnP.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<div>');
        if (selectFontSize) selectFontSize.value = '3'; // Normal
    });
}

if (selectFontSize) {
    selectFontSize.addEventListener('change', (e) => {
        const size = e.target.value;
        if (size) {
            document.execCommand('fontSize', false, size);
            selectFontSize.value = '3'; 
        }
    });
}

if (inputForeColor) {
    inputForeColor.addEventListener('input', (e) => {
        document.execCommand('foreColor', false, e.target.value);
    });
}

if (btnLink) {
    btnLink.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const url = prompt("Introduce la URL (ej: https://google.com):");
        if (url) {
            const formattedUrl = url.startsWith('http') ? url : 'https://' + url;
            document.execCommand('createLink', false, formattedUrl);
        }
    });
}

const btnSelectAll = document.getElementById('btn-select-all');
if (btnSelectAll) {
    btnSelectAll.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (inputCode) {
            inputCode.focus();
            document.execCommand('selectAll');
        }
    });
}

const btnClearFormat = document.getElementById('btn-clear-format');
if (btnClearFormat) {
    btnClearFormat.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (inputCode) {
            const selection = window.getSelection();
            const imgs = inputCode.querySelectorAll('img');
            const savedStyles = [];
            
            // Respaldar estilos de imágenes en la selección
            imgs.forEach(img => {
                if (selection.containsNode(img, true)) {
                    savedStyles.push({ img, style: img.getAttribute('style') });
                }
            });
            
            document.execCommand('removeFormat');
            document.execCommand('formatBlock', false, '<div>');
            
            // Restaurar estilos
            savedStyles.forEach(({ img, style }) => {
                if (style) img.setAttribute('style', style);
            });
        }
    });
}

// Interceptar clics en enlaces dentro del editor
if (inputCode) {
    inputCode.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const url = e.target.getAttribute('href');
            if (url && window.api && window.api.openExternal) {
                window.api.openExternal(url);
            }
        }
    });
}

btnBackFolders.addEventListener('click', async (e) => {
    e.preventDefault();
    await withUnsavedChangesGuard(async () => {
        switchView('folders');
        resetForm();
    });
});
btnSettings.addEventListener('click', async (e) => {
    e.preventDefault();
    await window.api.openSettingsWindow();
});

searchInput.addEventListener('input', (e) => {
    if(currentFolder) renderSnippets(e.target.value);
});

searchFolderInput.addEventListener('input', (e) => {
    renderFolders(e.target.value);
});

window.api.onShortcutRefreshForm(async () => {
    await refreshFormData(true);
});

window.api.onConfigUpdated(async () => {
    await refreshFormData(false);
});

// Modal Acerca de
const btnAbout = document.getElementById('btn-about');
const aboutModal = document.getElementById('about-modal');
const btnCloseAboutModal = document.getElementById('btn-close-about-modal');

if (btnAbout && aboutModal && btnCloseAboutModal) {
    btnAbout.addEventListener('click', () => {
        aboutModal.style.display = 'flex';
    });

    btnCloseAboutModal.addEventListener('click', () => {
        aboutModal.style.display = 'none';
    });

    // Cerrar si se hace clic fuera del modal
    window.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
    });
}

// Toggle Tema Claro / Oscuro
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');

function applyThemeIcon() {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    if (iconMoon && iconSun) {
        iconMoon.style.display = isLight ? 'none' : 'block';
        iconSun.style.display = isLight ? 'block' : 'none';
    }
}

// Aplicar ícono según el tema al cargar
applyThemeIcon();

if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
        const isLight = document.body.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('app-theme', 'dark');
        } else {
            document.body.setAttribute('data-theme', 'light');
            localStorage.setItem('app-theme', 'light');
        }
        applyThemeIcon();
    });
}

// --- MODO PANTALLA COMPLETA (ZEN) ---
const btnFullscreen = document.getElementById('btn-fullscreen');
const editorWrapper = document.querySelector('.code-editor-wrapper');

if (btnFullscreen && editorWrapper) {
    btnFullscreen.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const isFullscreen = editorWrapper.classList.toggle('fullscreen');
        const icon = btnFullscreen.querySelector('i');
        if (icon) {
            icon.className = isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
        }
        
        // Esconder el resizer si está abierto para evitar bugs visuales
        if (typeof hideResizeOverlay === 'function') {
            hideResizeOverlay();
        }
    });
}

// Iniciar app
init();

// --- FUNCIONALIDAD ACTIVA DE LA BARRA DE HERRAMIENTAS ---
document.addEventListener('selectionchange', () => {
    const isBold = document.queryCommandState('bold');
    if (btnBold) btnBold.classList.toggle('active', isBold);

    const blockType = document.queryCommandValue('formatBlock');
    // btnH2 ahora actúa como H1
    if (btnH2) btnH2.classList.toggle('active', blockType === 'h1');
    // btnH3 ahora actúa como H2
    if (btnH3) btnH3.classList.toggle('active', blockType === 'h2');

    if (selectFontSize) {
        if (blockType === 'h1') selectFontSize.value = '5';
        else if (blockType === 'h2') selectFontSize.value = '4';
        else selectFontSize.value = '3';
    }
});

// --- REDIMENSIONADO DE IMÁGENES VIA OVERLAY (4 Puntos) ---
let activeResizingImage = null;

// Crear el contenedor Overlay y los 4 tiradores
const resizerOverlay = document.createElement('div');
resizerOverlay.id = 'image-resizer-overlay';

const handles = ['tl', 'tr', 'bl', 'br'];
handles.forEach(type => {
    const h = document.createElement('div');
    h.className = `resize-handle ${type}`;
    h.setAttribute('data-handle', type);
    resizerOverlay.appendChild(h);
});
document.body.appendChild(resizerOverlay);

    if (inputCode) {
        inputCode.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                showResizeOverlay(e.target);
            } else {
                hideResizeOverlay();
            }
        });

    inputCode.addEventListener('scroll', hideResizeOverlay);
}

function showResizeOverlay(img) {
    activeResizingImage = img;
    const rect = img.getBoundingClientRect();
    resizerOverlay.style.display = 'block';
    resizerOverlay.style.width = rect.width + 'px';
    resizerOverlay.style.height = rect.height + 'px';
    resizerOverlay.style.left = (rect.left + window.scrollX) + 'px';
    resizerOverlay.style.top = (rect.top + window.scrollY) + 'px';
}

function hideResizeOverlay() {
    activeResizingImage = null;
    resizerOverlay.style.display = 'none';
}

let isDraggingHandle = false;
let currentHandleType = '';
let startX, startWidth;

resizerOverlay.addEventListener('mousedown', (e) => {
    if (!activeResizingImage || !e.target.classList.contains('resize-handle')) return;
    e.preventDefault();
    isDraggingHandle = true;
    currentHandleType = e.target.getAttribute('data-handle');
    startX = e.clientX;
    const rect = activeResizingImage.getBoundingClientRect();
    startWidth = rect.width;
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingHandle || !activeResizingImage) return;
    const deltaX = e.clientX - startX;
    let newWidth;
    
    // Si arrastras desde la derecha (br, tr), aumenta ancho
    if (currentHandleType === 'br' || currentHandleType === 'tr') {
        newWidth = Math.max(50, startWidth + deltaX);
    } else { // tl, bl (arrastrar a la izquierda expande)
        newWidth = Math.max(50, startWidth - deltaX);
    }
    
    activeResizingImage.style.width = newWidth + 'px';
    activeResizingImage.style.height = 'auto'; // Mantener aspect ratio
    showResizeOverlay(activeResizingImage); // Sincronizar posición del overlay
});

window.addEventListener('mouseup', () => {
    isDraggingHandle = false;
});

// Recargar al enfocar la ventana (por si se cambiaron configuraciones en otra ventana)
window.addEventListener('focus', async () => {
    if (typeof loadDataFromDisk === 'function') {
        await loadDataFromDisk();
        renderFolders();
        if (currentFolder === 'Eliminados') {
            const searchInput = document.getElementById('search-input');
            renderSnippets(searchInput ? searchInput.value : '');
        }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (!hasUnsavedChanges()) return;
    e.preventDefault();
    e.returnValue = '';
});

function applyLanguage(lang) {
    if (!window.getTranslation) return;
    document.title = window.getTranslation(lang, 'title');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = window.getTranslation(lang, key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = translation;
        } else {
            el.innerText = translation;
        }
    });
}

// --- ATATATAJOS DE TECLADO ---
window.addEventListener('keydown', (e) => {
    // Ctrl + E: Alternar Modo Expandido
    if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) {
            btnFullscreen.dispatchEvent(new MouseEvent('mousedown'));
        }
    }
    // Ctrl + S: Guardar
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveSnippet();
    }
});

// --- FUNCIONALIDAD BOTÓN LISTA ---
const btnList = document.getElementById('btn-list');
if (btnList) {
    btnList.addEventListener('mousedown', (e) => {
        e.preventDefault();
        insertHTMLAtCursor('&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;');
    });
}

// --- SINCRONIZACIÓN SELECTOR DE COLOR CREACIÓN ---
const modalNewColor = document.getElementById('modal-new-lang-color');
const modalNewColorHex = document.getElementById('modal-new-lang-color-hex');
if (modalNewColor && modalNewColorHex) {
    modalNewColor.addEventListener('input', (e) => {
        modalNewColorHex.value = e.target.value.toUpperCase();
    });
    modalNewColorHex.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            modalNewColor.value = val;
        }
    });
}

// Fin del archivo
