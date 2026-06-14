// ============================================================
//  APP.JS — Lógica do site de ofertas (público)
// ============================================================
 
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
 
// ── Constantes ────────────────────────────────────────────
const PAGE_SIZE = 12;
 
// Cores por plataforma (bg e text)
const PLATFORM_STYLES = {
  'Shopee':        { bg: '#EE4D2D', color: '#fff' },
  'Mercado Livre': { bg: '#FFE600', color: '#333' },
  'Amazon':        { bg: '#131921', color: '#FF9900' },
  'Magalu':        { bg: '#0086FF', color: '#fff' },
};
 
// ── Estado ────────────────────────────────────────────────
let allProducts      = [];   // todos os produtos válidos (não expirados)
let filteredProducts = [];   // após filtro de categoria + busca
let displayedCount   = 0;    // quantos já foram renderizados
let activeCategory   = 'all';
let searchTerm       = '';
 
// ── Elementos DOM ─────────────────────────────────────────
const container       = document.getElementById('products-container');
const skeletonLoader  = document.getElementById('skeleton-loader');
const noResults       = document.getElementById('no-results');
const errorState      = document.getElementById('error-state');
const loadMoreWrapper = document.getElementById('load-more-wrapper');
const loadMoreBtn     = document.getElementById('load-more-btn');
const searchInput     = document.getElementById('search-input');
const filterBtns      = document.querySelectorAll('.filter-btn');
 
// ── Escape HTML (segurança anti-XSS) ─────────────────────
function esc(str) {
  return (str ?? '').toString()
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
 
// ── Formata moeda pt-BR ───────────────────────────────────
function brl(value) {
  return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
 
// ── Skeleton loader ───────────────────────────────────────
function showSkeletons(count = PAGE_SIZE) {
  skeletonLoader.innerHTML = '';
  for (let i = 0; i < count; i++) {
    skeletonLoader.innerHTML += `
      <div class="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
        <div class="h-48 skeleton"></div>
        <div class="p-4 space-y-3">
          <div class="h-2.5 skeleton rounded w-1/3"></div>
          <div class="h-3.5 skeleton rounded"></div>
          <div class="h-3.5 skeleton rounded w-3/4"></div>
          <div class="h-10 skeleton rounded-lg mt-3"></div>
        </div>
      </div>`;
  }
  skeletonLoader.classList.remove('hidden');
}
 
function hideSkeletons() {
  skeletonLoader.classList.add('hidden');
  skeletonLoader.innerHTML = '';
}
 
// ── Cria card de produto (seguro contra XSS) ──────────────
function createProductCard(product) {
  const now          = new Date();
  const currentPrice = parseFloat(product.price) || 0;
  const origPrice    = parseFloat(product.originalPrice) || 0;
  const hasDiscount  = origPrice > 0 && origPrice > currentPrice;
  const discountPct  = hasDiscount ? Math.round((1 - currentPrice / origPrice) * 100) : 0;
 
  // Produto expirado: não mostrar
  if (product.expiresAt) {
    const expDate = product.expiresAt.toDate ? product.expiresAt.toDate() : new Date(product.expiresAt);
    if (expDate < now) return null;
  }
 
  // Produto novo (últimas 48h)?
  const isNew = product.createdAt?.toMillis
    ? (now.getTime() - product.createdAt.toMillis()) < 48 * 3600 * 1000
    : false;
 
  // Estilo da plataforma
  const pStyle = PLATFORM_STYLES[product.platform] || { bg: '#64748b', color: '#fff' };
 
  // Aviso de expiração próxima
  let expiryNotice = '';
  if (product.expiresAt) {
    const expDate = product.expiresAt.toDate ? product.expiresAt.toDate() : new Date(product.expiresAt);
    const daysLeft = Math.ceil((expDate - now) / 86400000);
    if (daysLeft > 0 && daysLeft <= 3) {
      expiryNotice = `<p class="text-xs text-center text-red-500 font-semibold mt-2">⏱ Expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}!</p>`;
    }
  }
 
  const card = document.createElement('div');
  card.className = 'product-card bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl';
 
  card.innerHTML = `
    <!-- Imagem -->
    <div class="relative h-48 bg-slate-50 flex items-center justify-center overflow-hidden">
      <img
        class="card-img max-h-full max-w-full object-contain p-4"
        src="${esc(product.imageUrl)}"
        alt="${esc(product.title)}"
        loading="lazy"
        onerror="this.src='https://placehold.co/200x200/f1f5f9/94a3b8?text=Sem+imagem'"
      >
 
      <!-- Badge de plataforma -->
      <span class="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide"
        style="background:${pStyle.bg}; color:${pStyle.color}">
        ${esc(product.platform)}
      </span>
 
      <!-- Badge de desconto -->
      ${hasDiscount && discountPct > 0 ? `
        <span class="badge-discount absolute top-2 right-2 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-lg shadow-md shadow-red-200">
          -${discountPct}%
        </span>` : ''}
 
      <!-- Badge HOT / NOVO -->
      ${product.isHot
        ? `<span class="absolute bottom-2 right-2 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow">🔥 QUENTE</span>`
        : isNew
          ? `<span class="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow">✨ NOVO</span>`
          : ''}
    </div>
 
    <!-- Corpo -->
    <div class="p-4 flex flex-col flex-grow">
      <p class="text-[11px] font-bold text-orange-500 uppercase tracking-wider mb-1">${esc(product.category || 'Oferta')}</p>
      <h3 class="text-slate-800 font-semibold text-sm leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">${esc(product.title)}</h3>
 
      ${product.description
        ? `<p class="text-xs text-slate-400 line-clamp-1 mb-2">${esc(product.description)}</p>`
        : ''}
 
      <!-- Preços -->
      <div class="mt-auto pt-3 border-t border-slate-100">
        ${hasDiscount
          ? `<p class="text-xs text-slate-400 line-through">${brl(origPrice)}</p>`
          : ''}
        <p class="text-xl font-black text-slate-900 leading-none mb-3">${brl(currentPrice)}</p>
 
        <a
          href="${esc(product.affiliateLink)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
        >
          Ver Oferta <i class="fas fa-arrow-right ml-1 text-xs"></i>
        </a>
 
        ${expiryNotice}
      </div>
    </div>
  `;
 
  return card;
}
 
// ── Renderiza uma página (PAGE_SIZE itens) ─────────────────
function renderPage(reset = false) {
  if (reset) {
    container.innerHTML = '';
    displayedCount = 0;
  }
 
  hideSkeletons();
 
  if (filteredProducts.length === 0) {
    container.classList.add('hidden');
    noResults.classList.remove('hidden');
    loadMoreWrapper.classList.add('hidden');
    return;
  }
 
  noResults.classList.add('hidden');
  container.classList.remove('hidden');
 
  const batch = filteredProducts.slice(displayedCount, displayedCount + PAGE_SIZE);
  let added = 0;
 
  batch.forEach(product => {
    const card = createProductCard(product);
    if (card) { container.appendChild(card); added++; }
  });
 
  displayedCount += batch.length;
 
  // Mostra "carregar mais" se ainda há produtos
  if (displayedCount < filteredProducts.length) {
    loadMoreWrapper.classList.remove('hidden');
  } else {
    loadMoreWrapper.classList.add('hidden');
  }
}
 
// ── Aplica filtros (categoria + busca) ────────────────────
function applyFilters() {
  filteredProducts = allProducts.filter(p => {
    const matchCat    = activeCategory === 'all' || (p.category && p.category.includes(activeCategory));
    const matchSearch = !searchTerm || p.title.toLowerCase().includes(searchTerm);
    return matchCat && matchSearch;
  });
  renderPage(true);
}
 
// ── Carrega produtos do Firestore ─────────────────────────
async function init() {
  showSkeletons();
 
  try {
    const q        = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
 
    allProducts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => {
        // Filtra expirados já no carregamento inicial
        if (!p.expiresAt) return true;
        const exp = p.expiresAt.toDate ? p.expiresAt.toDate() : new Date(p.expiresAt);
        return exp > new Date();
      });
 
    filteredProducts = allProducts;
    renderPage(true);
 
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    hideSkeletons();
    errorState.classList.remove('hidden');
  }
}
 
// ── Eventos ───────────────────────────────────────────────
 
// Busca por texto
searchInput.addEventListener('input', e => {
  searchTerm = e.target.value.toLowerCase().trim();
  applyFilters();
});
 
// Filtro por categoria
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Estilo dos botões
    filterBtns.forEach(b => {
      b.classList.remove('bg-orange-500', 'text-white');
      b.classList.add('text-slate-500');
    });
    btn.classList.add('bg-orange-500', 'text-white');
    btn.classList.remove('text-slate-500');
 
    activeCategory = btn.dataset.cat;
    applyFilters();
  });
});
 
// Carregar mais
loadMoreBtn.addEventListener('click', () => {
  renderPage(false);
});
 
// Inicia tudo
init();
 
