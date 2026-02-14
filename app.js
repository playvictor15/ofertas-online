import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Elementos da tela
const container = document.getElementById('products-container');
const loading = document.getElementById('loading');
const noResults = document.getElementById('no-results');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');

let allProducts = []; // Guarda todos os produtos na memória para filtrar rápido

// Função Principal
async function init() {
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            loading.innerHTML = "Nenhuma oferta cadastrada ainda.";
            return;
        }

        // Guarda os dados na memória
        snapshot.forEach(doc => {
            allProducts.push(doc.data());
        });

        renderProducts(allProducts); // Mostra tudo inicialmente
        loading.classList.add('hidden');
        container.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        loading.innerHTML = "<span class='text-red-500'>Erro ao carregar ofertas.</span>";
    }
}

// Função de Renderizar (Desenhar na tela)
function renderProducts(list) {
    container.innerHTML = "";
    
    if(list.length === 0) {
        container.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    noResults.classList.add('hidden');

    list.forEach(product => {
        const price = parseFloat(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Cores das Plataformas
        let platColor = 'bg-gray-500';
        if(product.platform === 'Shopee') platColor = 'bg-orange-500';
        if(product.platform === 'Mercado Livre') platColor = 'bg-yellow-500 text-black';
        if(product.platform === 'Amazon') platColor = 'bg-slate-800';

        const html = `
            <div class="product-card bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col h-full transition-all duration-300">
                <div class="relative h-56 p-4 flex items-center justify-center bg-gray-50">
                    <img src="${product.imageUrl}" alt="${product.title}" class="max-h-full max-w-full object-contain">
                    <span class="absolute top-2 right-2 ${platColor} text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                        ${product.platform}
                    </span>
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <p class="text-xs text-indigo-500 font-bold mb-1 uppercase">${product.category || 'Oferta'}</p>
                    <h3 class="text-gray-800 font-medium leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">${product.title}</h3>
                    <div class="mt-auto pt-4 border-t border-gray-100">
                        <div class="flex justify-between items-end mb-3">
                            <span class="text-xs text-gray-400">Por apenas</span>
                            <span class="text-2xl font-bold text-gray-900">${price}</span>
                        </div>
                        <a href="${product.affiliateLink}" target="_blank" class="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-lg shadow-indigo-200">
                            Ver Oferta <i class="fas fa-arrow-right ml-1"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- Lógica de Filtros e Busca ---

// 1. Busca por Texto
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p => p.title.toLowerCase().includes(term));
    renderProducts(filtered);
});

// 2. Filtro por Categoria
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Estilo dos botões
        filterBtns.forEach(b => {
            b.classList.remove('bg-indigo-100', 'text-indigo-800', 'border-indigo-200');
            b.classList.add('text-gray-600');
        });
        btn.classList.add('bg-indigo-100', 'text-indigo-800', 'border-indigo-200');
        btn.classList.remove('text-gray-600');

        const cat = btn.getAttribute('data-cat');
        
        if (cat === 'all') {
            renderProducts(allProducts);
        } else {
            // Filtra se a categoria começa com o termo (ex: 'Casa' acha 'Casa e Cozinha')
            const filtered = allProducts.filter(p => p.category && p.category.includes(cat));
            renderProducts(filtered);
        }
    });
});

// Inicia tudo
init();
