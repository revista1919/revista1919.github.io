// ImageManager.js - Componente para gestionar imágenes
"use strict";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

// ==================== CONFIGURACIÓN ====================
const MANAGE_IMAGES_URL = 'https://manageimages-ggqsq2kkua-uc.a.run.app/manageImages'; // Ajusta la URL
const BASE_IMAGE_URL = 'https://www.revistacienciasestudiantes.com/images';
const ITEMS_PER_PAGE = 12;

// ==================== UTILIDADES ====================
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const formatFileSize = (size) => {
  // Si ya viene formateado como "48K", devolverlo directamente
  if (typeof size === 'string' && (size.includes('K') || size.includes('M'))) {
    return size;
  }
  
  // Si es número, formatearlo
  const bytes = parseInt(size);
  if (isNaN(bytes) || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
};

// ==================== COMPONENTE PRINCIPAL ====================
export default function ImageManager({ user, onClose, onImageSelect, allowSelection = false }) {
  // Estados
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [customId, setCustomId] = useState('');
  const [conversionInfo, setConversionInfo] = useState(null);

  // ===== Cargar imágenes al montar =====
  useEffect(() => {
    loadImages();
  }, []);

  // ===== Función para cargar imágenes =====
  const loadImages = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(MANAGE_IMAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'list' })
      });

      if (!response.ok) throw new Error('Error al cargar imágenes');
      
      const data = await response.json();
      setImages(data.images || []);
      setStatus({ type: 'success', msg: `${data.total} imágenes cargadas` });
    } catch (error) {
      console.error('Error loading images:', error);
      setStatus({ type: 'error', msg: 'Error al cargar imágenes' });
    } finally {
      setLoading(false);
    }
  };

  // ===== Subir imagen =====
  const handleUpload = async (e) => {
    e?.preventDefault();
    
    if (!selectedFile) {
      setStatus({ type: 'error', msg: 'Selecciona un archivo' });
      return;
    }

    setUploading(true);
    setStatus({ type: 'info', msg: 'Procesando imagen...' });

    try {
      const token = await auth.currentUser.getIdToken();
      const base64 = await toBase64(selectedFile);
      
      // Generar ID si no se especificó
      const imageId = customId.trim() || generateSlug(selectedFile.name.split('.')[0]);
      
      const payload = {
        action: replaceMode ? 'replace' : 'upload',
        imageBase64: base64,
        imageId: imageId,
        fileName: replaceMode ? selectedImage?.name : undefined
      };

      const response = await fetch(MANAGE_IMAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error en la subida');
      
      const result = await response.json();
      
      // Guardar info de conversión
      if (result.converted) {
        setConversionInfo({
          originalFormat: result.originalFormat,
          finalFormat: result.extension
        });
      }

      // Recargar imágenes
      await loadImages();
      
      // Limpiar formulario
      resetUploadForm();
      setUploadModalOpen(false);
      
      setStatus({ 
        type: 'success', 
        msg: `✅ Imagen ${replaceMode ? 'reemplazada' : 'subida'} exitosamente. URL: ${result.url}` 
      });

      // Copiar URL automáticamente si no es reemplazo
      if (!replaceMode) {
        navigator.clipboard.writeText(result.url);
        setStatus({ type: 'success', msg: '✅ URL copiada al portapapeles' });
      }

    } catch (error) {
      console.error('Upload error:', error);
      setStatus({ type: 'error', msg: `❌ Error: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  // ===== Eliminar imagen =====
  const handleDelete = async (image) => {
    if (!confirm(`¿Estás seguro de eliminar "${image.name}"?`)) return;

    setUploading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(MANAGE_IMAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete',
          imageId: image.id,
          fileName: image.name
        })
      });

      if (!response.ok) throw new Error('Error al eliminar');
      
      await loadImages();
      setStatus({ type: 'success', msg: '✅ Imagen eliminada' });
      
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      setStatus({ type: 'error', msg: `❌ Error: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  // ===== Copiar URL al portapapeles =====
  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ type: 'success', msg: '✅ URL copiada' });
      setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      setStatus({ type: 'error', msg: '❌ Error al copiar' });
    }
  };

  // ===== Reset formulario de upload =====
  const resetUploadForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCustomId('');
    setReplaceMode(false);
    setConversionInfo(null);
  };

  // ===== Manejar selección de archivo =====
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // Sugerir ID basado en nombre del archivo
      if (!customId) {
        setCustomId(generateSlug(file.name.split('.')[0]));
      }
    }
  };

  // ===== Filtrar imágenes =====
  const filteredImages = useMemo(() => {
    if (!searchTerm.trim()) return images;
    const term = searchTerm.toLowerCase();
    return images.filter(img => 
      img.name.toLowerCase().includes(term) ||
      img.id.toLowerCase().includes(term)
    );
  }, [images, searchTerm]);

  // ===== Paginación =====
  const totalPages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE);
  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredImages.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredImages, currentPage]);

  // ===== Seleccionar imagen (modo selección) =====
  const handleSelectImage = (image) => {
    if (onImageSelect) {
      onImageSelect(image);
      onClose?.();
    } else {
      setSelectedImage(selectedImage?.id === image.id ? null : image);
    }
  };

  // ===== Abrir modal de reemplazo =====
  const openReplaceModal = (image) => {
    setSelectedImage(image);
    setReplaceMode(true);
    setCustomId(image.id);
    setUploadModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <PhotoIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Gestor de Imágenes</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode('grid');
              }}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setViewMode('list');
              }}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                resetUploadForm();
                setUploadModalOpen(true);
              }}
              className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              Subir Imagen
            </button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar imágenes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={loadImages}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between ${
              status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <span className="text-sm">{status.msg}</span>
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-black/5 rounded-full">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid de imágenes */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <ArrowPathIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Cargando imágenes...</p>
            </div>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No hay imágenes</p>
              <p className="text-gray-400 text-sm mb-4">
                {searchTerm ? 'Intenta con otra búsqueda' : 'Sube tu primera imagen'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Subir Primera Imagen
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedImages.map((image) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`group relative bg-gray-50 rounded-xl border-2 overflow-hidden ${
                  selectedImage?.id === image.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="aspect-square relative">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => handleSelectImage(image)}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/300?text=Error';
                    }}
                  />
                  
                  {/* Overlay en hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => copyToClipboard(image.url)}
                      className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      title="Copiar URL"
                    >
                      <DocumentDuplicateIcon className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => openReplaceModal(image)}
                      className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      title="Reemplazar imagen"
                    >
                      <ArrowPathIcon className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => handleDelete(image)}
                      className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-5 h-5 text-red-600" />
                    </button>
                  </div>

                  {/* Badge de formato */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full backdrop-blur-sm">
                    {image.extension}
                  </div>
                </div>

                <div className="p-3 bg-white">
                  <p className="text-sm font-medium text-gray-900 truncate" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(image.size)}
                  </p>
                  {allowSelection && (
                    <button
                      onClick={() => handleSelectImage(image)}
                      className={`mt-2 w-full py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedImage?.id === image.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedImage?.id === image.id ? 'Seleccionada' : 'Seleccionar'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          // Vista de lista
          <div className="space-y-2">
            {paginatedImages.map((image) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-4 p-3 rounded-lg border ${
                  selectedImage?.id === image.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/64?text=Error';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{image.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{image.extension}</span>
                    <span>{formatFileSize(image.size)}</span>
                    <span className="font-mono">{image.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(image.url)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Copiar URL"
                  >
                    <DocumentDuplicateIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openReplaceModal(image)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Reemplazar"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(image)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                  {allowSelection && (
                    <button
                      onClick={() => handleSelectImage(image)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedImage?.id === image.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedImage?.id === image.id ? '✓ Seleccionada' : 'Seleccionar'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal de subida */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            customId={customId}
            setCustomId={setCustomId}
            replaceMode={replaceMode}
            selectedImage={selectedImage}
            uploading={uploading}
            conversionInfo={conversionInfo}
            onFileSelect={handleFileSelect}
            onUpload={handleUpload}
            onClose={() => {
              resetUploadForm();
              setUploadModalOpen(false);
              setSelectedImage(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Botón cerrar si viene como modal */}
      {onClose && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== MODAL DE SUBIDA ====================
const UploadModal = ({
  selectedFile,
  previewUrl,
  customId,
  setCustomId,
  replaceMode,
  selectedImage,
  uploading,
  conversionInfo,
  onFileSelect,
  onUpload,
  onClose
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold">
            {replaceMode ? 'Reemplazar Imagen' : 'Subir Nueva Imagen'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {replaceMode && selectedImage && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Reemplazando: <strong>{selectedImage.name}</strong>
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                La nueva imagen mantendrá el mismo ID y URL
              </p>
            </div>
          )}

          {/* Selector de archivo */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              selectedFile ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onClick={() => document.getElementById('image-upload').click()}
          >
            {previewUrl ? (
              <div className="space-y-3">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-600">{selectedFile.name}</p>
              </div>
            ) : (
              <>
                <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">
                  Haz clic para seleccionar una imagen
                </p>
                <p className="text-xs text-gray-400">
                  JPG, PNG, GIF (se convertirá a WebP automáticamente)
                </p>
              </>
            )}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>

          {/* ID personalizado */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
              ID de la imagen (opcional)
            </label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(generateSlug(e.target.value))}
              placeholder="ej: imagen-principal-2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={replaceMode} // En replace mode, el ID es fijo
            />
            <p className="text-xs text-gray-400 mt-1">
              URL final: {customId ? `img-${customId}` : 'img-[timestamp]'}.webp
            </p>
          </div>

          {/* Info de conversión */}
          {conversionInfo && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <CheckIcon className="w-4 h-4" />
                Imagen optimizada: {conversionInfo.originalFormat} → {conversionInfo.finalFormat}
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              onClick={onUpload}
              disabled={!selectedFile || uploading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  {replaceMode ? 'Reemplazar' : 'Subir'}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};