import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";

/**
 * SERVIÇO DE PROCESSAMENTO & UPLOAD DE IMAGENS DE PRODUTOS
 * Gerencia compressão em alta resolução (HTML5 Canvas), upload resiliente no
 * Firebase Storage e fallback automático para Data URL em contingência/offline.
 */

export const DEFAULT_PRODUCT_FALLBACK =
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80";

/**
 * Amostras de fotos oficiais de moda praia / surfwear para uso rápido
 */
export const SURFWEAR_SAMPLE_PHOTOS = [
  {
    nome: "Camiseta Classic Silk Waves",
    url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    categoria: "Camiseta"
  },
  {
    nome: "Boardshort 4-Way Stretch Água",
    url: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=80",
    categoria: "Bermuda"
  },
  {
    nome: "Camisa Polo Piquet Premium",
    url: "https://images.unsplash.com/photo-1625910513413-7e54c5991448?w=800&auto=format&fit=crop&q=80",
    categoria: "Camisa Gola Polo"
  },
  {
    nome: "Short Tactel Tropical Summer",
    url: "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=800&auto=format&fit=crop&q=80",
    categoria: "Short"
  },
  {
    nome: "Boné Trucker Aba Curva LifeSurf",
    url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=80",
    categoria: "Acessórios"
  },
  {
    nome: "Regata DryFit Treino & Praia",
    url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80",
    categoria: "Camiseta"
  },
  {
    nome: "Camisa Térmica UV50+ Surf Pro",
    url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
    categoria: "Camisa"
  },
  {
    nome: "Jaqueta Corta-Vento Impermeável",
    url: "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
    categoria: "Casaco"
  }
];

/**
 * Retorna a URL da imagem de um produto inspecionando todos os possíveis aliases
 * @param {object} product - Objeto do produto
 * @returns {string} URL da imagem ou string vazia
 */
export function getProductImageUrl(product) {
  if (!product) return "";
  const candidates = [
    product.fotoUrl,
    product.imageUrl,
    product.imagem,
    product.imagemUrl,
    product.foto,
    product.image,
    product.url,
    product.foto_url
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "";
}

/**
 * Otimiza e redimensiona um arquivo de imagem utilizando HTML5 Canvas no navegador
 * Converte imagens pesadas de smartphones (5MB-10MB) para ~80KB-140KB de alta nitidez
 * @param {File|Blob} file - Arquivo original
 * @param {number} maxWidth - Largura máxima (padrão: 960px)
 * @param {number} maxHeight - Altura máxima (padrão: 960px)
 * @param {number} quality - Qualidade de compressão (0.1 a 1.0)
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function compressImageFile(file, maxWidth = 960, maxHeight = 960, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) {
      reject(new Error("Arquivo de imagem inválido para compressão"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não suportado"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Mantém a proporção exata sem distorção
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        // Suavização bilinear para preservar nitidez das estampas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Gera DataURL
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Gera Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              // Fallback para conversão manual do dataURL
              resolve({ blob: file, dataUrl });
            }
          },
          mimeType,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Realiza upload da imagem para o Firebase Storage com contingência automática
 * @param {string} tenantId - Identificador da empresa
 * @param {File|Blob} fileOrBlob - Arquivo da imagem selecionado pelo usuário
 * @param {string} customFileName - Nome sugerido para o arquivo
 * @returns {Promise<{ url: string, isDataUrl: boolean }>}
 */
export async function uploadProductImage(tenantId, fileOrBlob, customFileName = "produto.jpg") {
  const tenant = tenantId || "lifesurf";
  if (!fileOrBlob) {
    throw new Error("Nenhum arquivo fornecido para upload");
  }

  // 1. Otimiza a imagem via Canvas
  let compressedBlob = fileOrBlob;
  let compressedDataUrl = "";
  try {
    const result = await compressImageFile(fileOrBlob, 960, 960, 0.85);
    compressedBlob = result.blob;
    compressedDataUrl = result.dataUrl;
  } catch (err) {
    console.warn("[imageUploadService] Falha na compressão, usando arquivo original:", err);
  }

  // 2. Tenta fazer upload no Firebase Storage se disponível
  if (storage) {
    try {
      const cleanName = (customFileName || "produto.jpg")
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "-")
        .replace(/-+/g, "-");
      const storagePath = `empresas/${tenant}/produtos/${Date.now()}_${cleanName}`;
      const storageRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(storageRef, compressedBlob, {
        contentType: compressedBlob.type || "image/jpeg",
        cacheControl: "public, max-age=31536000"
      });

      const downloadUrl = await getDownloadURL(snapshot.ref);
      return {
        url: downloadUrl,
        isDataUrl: false,
        storagePath
      };
    } catch (storageError) {
      console.warn(
        "[imageUploadService] Firebase Storage indisponível ou bloqueado por regras. Usando Data URL persistente:",
        storageError?.message || storageError
      );
    }
  }

  // 3. Fallback Resiliente: Retorna Data URL otimizado
  // Funciona 100% no Firestore, localStorage e navegadores sem falhas de CORS ou rede
  if (compressedDataUrl) {
    return {
      url: compressedDataUrl,
      isDataUrl: true,
      storagePath: null
    };
  }

  // Fallback final
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        url: e.target.result,
        isDataUrl: true,
        storagePath: null
      });
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
