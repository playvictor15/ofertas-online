// ============================================================
//  ADMIN.JS — Painel Administrativo OfertasVIP
// ============================================================

import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, onSnapshot,
  query, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ════════════════════════════════════════════════════════════
//  AUTH GUARD
//  O <body> começa invisível (CSS: opacity:0) para evitar que
//  o painel apareça um frame antes de confirmar o login.
//  Um timeout de segurança evita travar a tela para sempre.
// ════════════════════════════════════════════════════════════
const revealPage  = () => document.body.classList.add('auth-ready');
const authTimeout = setTimeout(revealPage, 6000); // failsafe

onAuthStateChanged(auth, user => {
  clearTimeout(authTimeout);
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  revealPage();
  subscribeProducts(); // inicia escuta em tempo real
});


// ════════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════════
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (e) {
    toast('Erro ao sair. Tente novamente.', 'error');
  }
});


// ════════════════════════════════════════════════════════════
//  SISTEMA DE TOAST (substitui alert())
// ════════════════════════════════════════════════════════════
const toastContainer = (() => {
  const el = document.createElement('div');
  el.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
  document.body.appendChild(el);
  return el;
})();

function toast(message, type = 'success') {
  const map = {
    success: { bg: 'bg-green-500',  icon: 'fa-circle-check' },
    error:   { bg: 'bg-red-500',    icon: 'fa-circle-xmark' },
    warning: { bg: 'bg-amber-500',  icon: 'fa-triangle-exclamation' },
    info:    { bg: 'bg-blue-500',   icon: 'fa-circle-info' },
  };
  const { bg, icon } = map[type] ?? map.info;

  const el = document.createElement('div');
  el.className = `toast pointer-events-auto ${bg} text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs translate-x-full opacity-0`;
  el.innerHTML = `<i class="fas ${icon} shrink-0"></i><span>${message}</span>`;
  toastContainer.appendChild(el);

  requestAnimationFrame(() => el.classList.remove('translate-x-full', 'opacity-0'));

  setTimeout(() => {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => el.remove(), 350);
  }, 3500);
}


// ════════════════════════════════════════════════════════════
//  MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
//  (não usa window.confirm() que bloqueia a thread)
// ════════════════════════════════════════════════════════════
const confirmModal     = document.getElementById('confirm-modal');
const modalProductName = document.getElementById('modal-product-name');
let pendingDeleteId    = null;

function showDeleteModal(id, name) {
  pendingDeleteId = id;
  modalProductName.textContent = name || 'este produto';
  confirmModal.classList.remove('hidden');
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  pendingDeleteId = null;
});

document.getElementById('modal-confirm').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  confirmModal.classList.add('hidden');
  pendingDeleteId = null;
  try {
    await deleteDoc(doc(db, 'products', id));
    toast('Produto apagado com sucesso.', 'success');
  } catch (err) {
    console.error('Erro ao apagar:', err);
    toast('Não foi possível apagar o produto.', 'error');
  }
});

// Fechar clicando fora do card do modal
confirmModal.addEventListener('click', e => {
  if (e.target === confirmModal) {
    confirmModal.classList.add('hidden');
    pendingDeleteId = null;
  }
});


// ════════════════════════════════════════════════════════════
//  REFERÊNCIAS DO FORMULÁRIO
// ════════════════════════════════════════════════════════════
const form            = document.getElementById('product-form');
const titleInput      = document.getElementById('title');
const descInput       = document.getElementById('description');
const priceInput      = document.getElementById('price');
const origPriceInput  = document.getElementById('original-price');
const platformInput   = document.getElementById('platform');
const categoryInput   = document.getElementById('category');
const imageUrlInput   = document.getElementById('image-url');
const affiliateInput  = document.getElementById('affiliate-link');
const expiresInput    = document.getElementById('expires-at');
const isHotInput      = document.getElementById('is-hot');
const submitBtn       = document.getElementById('submit-btn');
const cancelEditBtn   = document.getElementById('cancel-edit-btn');
const formTitle       = document.getElementById('form-title');
const discPreview     = document.getElementById('discount-preview');
const discText        = document.getElementById('discount-text');
const imgPreviewBox   = document.getElementById('img-preview-box');
const imgPreview      = document.getElementById('img-preview');

let editingId = null; // null = modo adição | string = modo edição


// ════════════════════════════════════════════════════════════
//  AUTO-CÁLCULO DO DESCONTO
// ════════════════════════════════════════════════════════════
function updateDiscountPreview() {
  const curr = parseFloat(priceInput.value)     || 0;
  const orig = parseFloat(origPriceInput.value) || 0;
  if (orig > 0 && curr > 0 && orig > curr) {
    const pct = Math.round((1 - curr / orig) * 100);
    discText.textContent = `Desconto calculado: ${pct}% OFF`;
    discPreview.classList.remove('hidden');
  } else {
    discPreview.classList.add('hidden');
  }
}
priceInput.addEventListener('input',    updateDiscountPreview);
origPriceInput.addEventListener('input', updateDiscountPreview);


// ════════════════════════════════════════════════════════════
//  PREVIEW DA IMAGEM (debounced 600ms)
// ════════════════════════════════════════════════════════════
let imgTimer;
imageUrlInput.addEventListener('input', () => {
  clearTimeout(imgTimer);
  imgTimer = setTimeout(() => {
    const url = imageUrlInput.value.trim();
    if (!url) { imgPreviewBox.classList.add('hidden'); return; }
    imgPreview.src     = url;
    imgPreview.onload  = () => imgPreviewBox.classList.remove('hidden');
    imgPreview.onerror = () => imgPreviewBox.classList.add('hidden');
  }, 600);
});


// ════════════════════════════════════════════════════════════
//  COLETA + VALIDA DADOS DO FORMULÁRIO
// ════════════════════════════════════════════════════════════
function getFormData() {
  let expiresAt = null;
  if (expiresInput.value) {
    // Interpreta a data como fim do dia no horário local
    const d = new Date(expiresInput.value + 'T23:59:59');
    expiresAt = Timestamp.fromDate(d);
  }
  return {
    title:         titleInput.value.trim(),
    description:   descInput.value.trim(),
    price:         parseFloat(priceInput.value)     || 0,
    originalPrice: parseFloat(origPriceInput.value) || 0,
    platform:      platformInput.value,
    category:      categoryInput.value,
    imageUrl:      imageUrlInput.value.trim(),
    affiliateLink: affiliateInput.value.trim(),
    isHot:         isHotInput.checked,
    expiresAt,
  };
}

function validate(data) {
  if (!data.title)          { toast('Informe o nome do produto.', 'warning');    return false; }
  if (data.price <= 0)      { toast('Informe o preço atual.',     'warning');    return false; }
  if (!data.imageUrl)       { toast('Informe a URL da imagem.',   'warning');    return false; }
  if (!data.affiliateLink)  { toast('Informe o link de afiliado.','warning');    return false; }
  return true;
}


// ════════════════════════════════════════════════════════════
//  RESET DO FORMULÁRIO
// ════════════════════════════════════════════════════════════
function resetForm() {
  editingId = null;
  form.reset();
  discPreview.classList.add('hidden');
  imgPreviewBox.classList.add('hidden');
  cancelEditBtn.classList.add('hidden');
  formTitle.textContent = 'Novo Produto';
  submitBtn.innerHTML   = '<i class="fas fa-upload"></i> <span>Publicar Oferta</span>';
  submitBtn.disabled    = false;
}
cancelEditBtn.addEventListener('click', resetForm);


// ════════════════════════════════════════════════════════════
//  PREENCHE FORMULÁRIO PARA EDIÇÃO
// ════════════════════════════════════════════════════════════
function fillFormForEdit(id, data) {
  editingId = id;

  titleInput.value     = data.title           || '';
  descInput.value      = data.description     || '';
  priceInput.value     = data.price           || '';
  origPriceInput.value = data.originalPrice   || '';
  platformInput.value  = data.platform        || 'Shopee';
  categoryInput.value  = data.category        || 'Tecnologia';
  imageUrlInput.value  = data.imageUrl        || '';
  affiliateInput.value = data.affiliateLink   || '';
  isHotInput.checked   = data.isHot           || false;

  if (data.expiresAt) {
    const d = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    expiresInput.value = d.toISOString().split('T')[0];
  } else {
    expiresInput.value = '';
  }

  if (data.imageUrl) {
    imgPreview.src = data.imageUrl;
    imgPreviewBox.classList.remove('hidden');
  }

  updateDiscountPreview();

  formTitle.textContent = 'Editar Produto';
  submitBtn.innerHTML   = '<i class="fas fa-floppy-disk"></i> <span>Salvar Alterações</span>';
  cancelEditBtn.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  titleInput.focus();
}


// ════════════════════════════════════════════════════════════
//  SUBMIT: ADICIONAR OU EDITAR
// ════════════════════════════════════════════════════════════
function setLoading(on) {
  submitBtn.disabled  = on;
  submitBtn.innerHTML = on
    ? '<i class="fas fa-circle-notch fa-spin"></i> Salvando...'
    : editingId
      ? '<i class="fas fa-floppy-disk"></i> Salvar Alterações'
      : '<i class="fas fa-upload"></i> Publicar Oferta';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = getFormData();
  if (!validate(data)) return;

  setLoading(true);
  try {
    if (editingId) {
      await updateDoc(doc(db, 'products', editingId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      toast('Produto atualizado! ✅', 'success');
    } else {
      await addDoc(collection(db, 'products'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      toast('Oferta publicada! 🚀', 'success');
    }
    resetForm();
  } catch (err) {
    console.error('Erro ao salvar produto:', err);
    toast('Erro ao salvar. Verifique o console.', 'error');
  } finally {
    setLoading(false);
  }
});


// ════════════════════════════════════════════════════════════
//  LISTA DE PRODUTOS (TEMPO REAL)
// ════════════════════════════════════════════════════════════
const adminList   = document.getElementById('admin-list');
const listEmpty   = document.getElementById('list-empty');
const adminSearch = document.getElementById('admin-search');

let allAdminProducts = [];

const PLATFORM_BADGE = {
  'Shopee':        'bg-orange-100 text-orange-700',
  'Mercado Livre': 'bg-yellow-100 text-yellow-700',
  'Amazon':        'bg-slate-800  text-yellow-400',
  'Magalu':        'bg-blue-100   text-blue-700',
};

function brl(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderAdminList(products) {
  const term = adminSearch.value.toLowerCase().trim();
  const list = term
    ? products.filter(p => (p.title || '').toLowerCase().includes(term))
    : products;

  adminList.innerHTML = '';

  if (list.length === 0) {
    listEmpty.classList.remove('hidden');
    return;
  }
  listEmpty.classList.add('hidden');

  list.forEach(({ id, ...data }) => {
    const now       = new Date();
    const isExpired = data.expiresAt
      ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) < now
      : false;

    const platClass   = PLATFORM_BADGE[data.platform] || 'bg-slate-100 text-slate-600';
    const statusBadge = isExpired
      ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Expirado</span>'
      : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">Ativo</span>';

    const li = document.createElement('li');
    li.className = 'flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-200';

    // Monta HTML com dados escapados via textContent depois
    li.innerHTML = `
      <img
        class="w-12 h-12 object-contain rounded-lg bg-slate-100 shrink-0 border border-slate-200"
        loading="lazy"
        onerror="this.src='https://placehold.co/48x48/f1f5f9/94a3b8?text=?'"
      >
      <div class="flex-1 min-w-0">
        <p class="item-title font-semibold text-sm text-slate-800 truncate"></p>
        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${platClass} item-platform"></span>
          ${statusBadge}
          <span class="text-xs font-bold text-slate-700 item-price"></span>
          ${data.isHot ? '<span title="Oferta quente">🔥</span>' : ''}
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
        <button class="edit-btn w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition flex items-center justify-center" title="Editar">
          <i class="fas fa-pencil text-xs"></i>
        </button>
        <button class="delete-btn w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition flex items-center justify-center" title="Apagar">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </div>
    `;

    // Preenche dados com textContent (seguro contra XSS)
    li.querySelector('img').src                = data.imageUrl || '';
    li.querySelector('img').alt                = data.title    || '';
    li.querySelector('.item-title').textContent    = data.title    || '–';
    li.querySelector('.item-platform').textContent = data.platform || '';
    li.querySelector('.item-price').textContent    = brl(data.price);

    li.querySelector('.edit-btn').addEventListener('click', () => fillFormForEdit(id, data));
    li.querySelector('.delete-btn').addEventListener('click', () => showDeleteModal(id, data.title));

    adminList.appendChild(li);
  });
}

adminSearch.addEventListener('input', () => renderAdminList(allAdminProducts));


// ════════════════════════════════════════════════════════════
//  STATS DA NAVBAR
// ════════════════════════════════════════════════════════════
function updateStats(products) {
  const now = new Date();
  let active = 0, expired = 0;

  products.forEach(p => {
    if (!p.expiresAt) { active++; return; }
    const d = p.expiresAt.toDate ? p.expiresAt.toDate() : new Date(p.expiresAt);
    d < now ? expired++ : active++;
  });

  document.getElementById('stat-total').textContent   = products.length;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-expired').textContent = expired;
  document.getElementById('nav-stats').classList.remove('hidden');
}


// ════════════════════════════════════════════════════════════
//  SUBSCRIBE (TEMPO REAL) — últimos 50 produtos
// ════════════════════════════════════════════════════════════
function subscribeProducts() {
  const q = query(
    collection(db, 'products'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  onSnapshot(q, snapshot => {
    allAdminProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats(allAdminProducts);
    renderAdminList(allAdminProducts);
  }, err => {
    console.error('Erro ao sincronizar produtos:', err);
    toast('Erro de conexão com o banco de dados.', 'error');
  });
}
