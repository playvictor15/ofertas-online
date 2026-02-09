import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const container = document.getElementById('products-container');

async function loadProducts() {
    try {
        // Busca produtos ordenados pela data de criação (mais novos primeiro)
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        container.innerHTML = ""; // Limpa o loading

        if(querySnapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum produto cadastrado no momento.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const priceFormatted = parseFloat(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // Define cor do badge baseada na plataforma
            const badgeColor = product.platform === 'Shopee' ? 'bg-orange-500' : 'bg-yellow-500 text-black';

            const html = `
                <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
                    <div class="relative h-48 overflow-hidden">
                        <img src="${product.imageUrl}" alt="${product.title}" class="w-full h-full object-cover">
                        <span class="absolute top-2 right-2 ${badgeColor} text-white text-xs font-bold px-2 py-1 rounded">
                            ${product.platform}
                        </span>
                    </div>
                    <div class="p-4 flex flex-col flex-grow">
                        <h3 class="text-lg font-semibold mb-2 line-clamp-2">${product.title}</h3>
                        <p class="text-2xl font-bold text-gray-800 mb-4">${priceFormatted}</p>
                        <a href="${product.affiliateLink}" target="_blank" class="mt-auto block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors">
                            Ver na Loja <i class="fas fa-external-link-alt ml-1"></i>
                        </a>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Erro ao carregar produtos.</p>';
    }
}

loadProducts();
