// === TEMA: Inicializar ANTES de renderizar para evitar parpadeo ===
(function initTheme() {
    const saved = localStorage.getItem('app-theme') || 'dark';
    if (saved === 'light') {
        document.body.setAttribute('data-theme', 'light');
    }
})();

// Estado de la aplicación
let snippets = [];
let lenguajes = [];
let currentSnippetId = null;
let currentFolder = null;
let appConfig = { autor: '' };

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
const btnSettings = document.getElementById('btn-settings');

// Botón Copiar y Editor
const btnCopy = document.getElementById('btn-copy');
const lineNumbersDiv = document.getElementById('line-numbers');

// Inicialización
async function init() {
    await loadDataFromDisk();
    await loadAppConfig();
    
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
    appConfig = config && typeof config === 'object' ? config : { autor: '' };
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
        div.addEventListener('click', () => {
            switchView('snippets', lang.Nombre);
            resetForm();
        });
        
        folderList.appendChild(div);
    });
}

// Eliminar Carpeta
async function deleteFolder(id) {
    if (confirm("¿Estás seguro de eliminar este lenguaje? Sus snippets no serán borrados físicamente pero esta carpeta desaparecerá.")) {
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
                <span class="lang-name-display">${lang.Nombre}</span>
                <input type="text" class="lang-name-edit" value="${lang.Nombre}" style="display: none; width: 100%; padding: 4px; background: var(--input-bg); border: 1px solid var(--accent-color); color: #fff; outline: none;">
            </td>
            <td><span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Activo' : 'Inactivo'}</span></td>
            <td class="action-links">
                <button class="action-link edit btn-edit-lang">Editar</button>
                <button class="action-link edit btn-save-lang" style="display: none;">Guardar</button>
                <button class="action-link toggle btn-toggle-lang">${isActive ? 'Desactivar' : 'Activar'}</button>
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
            btnEdit.style.display = 'none';
            btnSave.style.display = 'inline-block';
            nameEdit.focus();
        });

        // Guardar edición
        btnSave.addEventListener('click', async () => {
            const newName = nameEdit.value.trim();
            const formattedName = newName.charAt(0).toUpperCase() + newName.slice(1);
            
            if (formattedName && formattedName !== lang.Nombre) {
                const exists = lenguajes.find(l => l.Nombre.toLowerCase() === formattedName.toLowerCase() && l.ID !== lang.ID);
                if (exists) {
                    showToast('Ese nombre ya está en uso.', 'error');
                    return;
                }
                
                // Actualizar snippets que tenían este lenguaje
                const oldName = lang.Nombre;
                snippets.forEach(s => {
                    if (s.Lenguaje === oldName) s.Lenguaje = formattedName;
                });
                await window.api.writeData('snippets', snippets);

                lang.Nombre = formattedName;
                lang.Codigo = formattedName.toLowerCase();
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

        modalLanguageList.appendChild(tr);
    });
}

// Agregar Lenguaje desde Modal
btnModalAddLang.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = modalNewLangInput.value.trim();
    if (!name) return;
    
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    const exists = lenguajes.find(l => l.Nombre.toLowerCase() === formattedName.toLowerCase());
    if (exists) {
        if (!exists.Activo) {
            exists.Activo = true;
        } else {
            showToast('¡Este lenguaje ya existe y está activo!', 'error');
            return;
        }
    } else {
        const newId = lenguajes.length > 0 ? Math.max(...lenguajes.map(l => l.ID)) + 1 : 1;
        lenguajes.push({ ID: newId, Nombre: formattedName, Codigo: formattedName.toLowerCase(), Activo: true });
    }
    
    const result = await window.api.writeData('lenguajes', lenguajes);
    if(result.success) {
        modalNewLangInput.value = '';
        renderLanguageModalList();
        renderLanguages();
        renderFolders();
    } else {
        showToast("Error al guardar lenguaje", 'error');
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

// Renderizar Snippets en el Panel Izquierdo (por carpeta actual)
function renderSnippets(searchTerm = '') {
    snippetList.innerHTML = '';
    
    const filtered = snippets.filter(s => {
        if (!s.Activo) return false;
        if (currentFolder && s.Lenguaje.toLowerCase() !== currentFolder.toLowerCase()) return false;
        
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
        div.onclick = () => selectSnippet(snippet.ID);
        
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
function selectSnippet(id) {
    const snippet = snippets.find(s => s.ID === id);
    if (!snippet) return;

    currentSnippetId = snippet.ID;
    inputId.value = snippet.ID;
    inputTitle.value = snippet.Titulo;
    inputPurpose.value = snippet.Proposito;
    inputAuthor.value = snippet.Autor || appConfig.autor || '';
    inputLanguage.value = snippet.Lenguaje;
    inputCode.value = snippet.Codigo;

    btnDelete.style.display = 'block';
    
    renderSnippets(searchInput.value);
    updateLineNumbers();
}

// Funcionalidad "Nuevo" / "Cancelar"
function resetForm() {
    currentSnippetId = null;
    
    inputId.value = '';
    inputTitle.value = '';
    inputPurpose.value = '';
    inputAuthor.value = appConfig.autor || '';
    inputLanguage.value = currentFolder || ''; // Prellenar con la carpeta actual si estamos en una
    inputCode.value = '';
    
    inputTitle.disabled = false;
    inputPurpose.disabled = false;
    inputAuthor.disabled = false;
    inputLanguage.disabled = false;
    inputCode.disabled = false;

    btnDelete.style.display = 'none';
    if(currentFolder) inputTitle.focus();
    
    if (snippetsView.style.display !== 'none') {
        renderSnippets(searchInput.value);
    }
    updateLineNumbers();
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
        return;
    }

    const title = inputTitle.value.trim().toUpperCase();
    const purpose = inputPurpose.value.trim();
    const author = inputAuthor.value.trim() || appConfig.autor || '';
    const rawLanguage = inputLanguage.value.trim();
    const formattedLanguage = formatLanguage(rawLanguage);
    const code = inputCode.value;

    if (currentSnippetId) {
        const index = snippets.findIndex(s => s.ID === currentSnippetId);
        if (index !== -1) {
            snippets[index] = { ...snippets[index], Titulo: title, Proposito: purpose, Autor: author, Lenguaje: formattedLanguage, Codigo: code };
        }
    } else {
        const newId = snippets.length > 0 ? Math.max(...snippets.map(s => s.ID)) + 1 : 1;
        snippets.push({ ID: newId, Titulo: title, Proposito: purpose, Autor: author, Lenguaje: formattedLanguage, Codigo: code, Activo: true });
        currentSnippetId = newId;
    }

    const result = await window.api.writeData('snippets', snippets);
    if (result.success) {
        inputLanguage.value = formattedLanguage;
        btnDelete.style.display = 'block';
        
        // Si el lenguaje guardado es distinto a la carpeta actual, volvemos a renderizar carpetas para actualizar conteo
        renderFolders();
        if (snippetsView.style.display !== 'none') {
            renderSnippets(searchInput.value);
        }
        showToast("¡Snippet guardado con éxito!", 'success');
    } else {
        showToast("Error al guardar: " + result.error, 'error');
    }
}

// Eliminar
async function deleteSnippet() {
    if (!currentSnippetId) return;
    if (confirm("¿Estás seguro de eliminar este snippet?")) {
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

// Lógica de editor de código (Líneas y Copiar)
function updateLineNumbers() {
    const lines = inputCode.value.split('\n').length;
    const count = lines > 0 ? lines : 1;
    lineNumbersDiv.innerHTML = Array(count).fill(0).map((_, i) => i + 1).join('<br>');
}

inputCode.addEventListener('scroll', () => { lineNumbersDiv.scrollTop = inputCode.scrollTop; });
inputCode.addEventListener('input', updateLineNumbers);

btnCopy.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!inputCode.value) return;
    try {
        await navigator.clipboard.writeText(inputCode.value);
        const originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="#4ade80" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        btnCopy.style.borderColor = '#4ade80';
        setTimeout(() => { btnCopy.innerHTML = originalHtml; btnCopy.style.borderColor = ''; }, 1500);
    } catch (err) { console.error('Error copiando: ', err); }
});

// Event Listeners Base
btnNew.addEventListener('click', (e) => { e.preventDefault(); resetForm(); });
btnRefresh.addEventListener('click', async (e) => {
    e.preventDefault();
    await refreshFormData(true);
});
btnSave.addEventListener('click', (e) => { e.preventDefault(); saveSnippet(); });
btnDelete.addEventListener('click', (e) => { e.preventDefault(); deleteSnippet(); });
btnCancel.addEventListener('click', (e) => { e.preventDefault(); resetForm(); });

btnBackFolders.addEventListener('click', (e) => { e.preventDefault(); switchView('folders'); resetForm(); });
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

// Iniciar app
init();
