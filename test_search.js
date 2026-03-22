function normalizeString(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function filterSnippets(snippets, searchTerm, currentFolder) {
    return snippets.filter(s => {
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
}

// Test cases
const mockSnippets = [
    { Titulo: "CONEXIÓN A BD", Proposito: "Conectar a SQL Server", Lenguaje: "PowerShell", Codigo: "test01" },
    { Titulo: "TEST02", Proposito: "test02", Lenguaje: "JavaScript", Codigo: "console.log('hola');" },
    { Titulo: "FUNCIÓN SUMAR", Proposito: "Sumar dos números", Lenguaje: "JavaScript", Codigo: "function sumar(a,b){ return a+b; }" }
];

console.log("Test 1: 'conexion' should match 'CONEXIÓN A BD'");
let res1 = filterSnippets(mockSnippets, "conexion", "PowerShell");
console.log(res1.length === 1 && res1[0].Titulo === "CONEXIÓN A BD" ? "PASS" : "FAIL");

console.log("Test 2: 'sumar' should match 'FUNCIÓN SUMAR' and 'sumar' in code");
let res2 = filterSnippets(mockSnippets, "sumar", "JavaScript");
console.log(res2.length === 1 && res2[0].Titulo === "FUNCIÓN SUMAR" ? "PASS" : "FAIL");

console.log("Test 3: 'hola' should match 'console.log(\"hola\")' in code");
let res3 = filterSnippets(mockSnippets, "hola", "JavaScript");
console.log(res3.length === 1 && res3[0].Titulo === "TEST02" ? "PASS" : "FAIL");

console.log("Test 4: 'conexion sql' should match");
let res4 = filterSnippets(mockSnippets, "conexion sql", "PowerShell");
console.log(res4.length === 1 && res4[0].Titulo === "CONEXIÓN A BD" ? "PASS" : "FAIL");
