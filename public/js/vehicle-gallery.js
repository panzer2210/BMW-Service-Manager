class BMWVehicleGallery {
    constructor() {
        this.currentVehicle = null;
        this.images = [];
        this.currentImageIndex = 0;
        this.sampleImages = this.generateSampleImages();
    }

    generateSampleImages() {
        // Generate sample BMW vehicle images
        return {
            'BMW X5': [
                { id: 1, url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800', title: 'Exterior Front', category: 'exterior' },
                { id: 2, url: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800', title: 'Interior Dashboard', category: 'interior' },
                { id: 3, url: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=800', title: 'Side Profile', category: 'exterior' },
                { id: 4, url: 'https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?w=800', title: 'Engine Bay', category: 'technical' }
            ],
            'BMW 330i': [
                { id: 5, url: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800', title: 'Exterior Front', category: 'exterior' },
                { id: 6, url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800', title: 'Interior Seats', category: 'interior' },
                { id: 7, url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800', title: 'Wheel Detail', category: 'detail' }
            ],
            'BMW iX3': [
                { id: 8, url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800', title: 'Electric Front', category: 'exterior' },
                { id: 9, url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800', title: 'Interior Tech', category: 'interior' },
                { id: 10, url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800', title: 'Charging Port', category: 'technical' }
            ]
        };
    }

    openGallery(vehicleData) {
        this.currentVehicle = vehicleData;
        this.images = this.sampleImages[vehicleData.model] || this.sampleImages['BMW X5'];
        this.currentImageIndex = 0;
        this.createGalleryModal();
    }

    createGalleryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal gallery-modal';
        modal.style.display = 'block';
        modal.id = 'vehicleGalleryModal';

        modal.innerHTML = `
            <div class="gallery-container">
                <span class="close gallery-close" onclick="document.getElementById('vehicleGalleryModal').remove()">&times;</span>
                
                <div class="gallery-header">
                    <h2>📸 ${this.currentVehicle.model} Gallery</h2>
                    <div class="gallery-info">
                        <span class="vehicle-year">${this.currentVehicle.year}</span>
                        <span class="vehicle-color">${this.currentVehicle.color}</span>
                        <span class="vehicle-vin">VIN: ${this.currentVehicle.vin}</span>
                    </div>
                </div>

                <div class="gallery-main">
                    <div class="main-image-container">
                        <button class="gallery-nav prev" onclick="window.vehicleGallery.previousImage()">
                            ❮
                        </button>
                        
                        <div class="main-image-wrapper">
                            <img id="mainGalleryImage" src="${this.images[0]?.url}" alt="${this.images[0]?.title}" class="main-image">
                            <div class="image-overlay">
                                <div class="image-title">${this.images[0]?.title}</div>
                                <div class="image-counter">1 / ${this.images.length}</div>
                            </div>
                        </div>
                        
                        <button class="gallery-nav next" onclick="window.vehicleGallery.nextImage()">
                            ❯
                        </button>
                    </div>

                    <div class="gallery-thumbnails">
                        ${this.images.map((img, index) => `
                            <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                                 onclick="window.vehicleGallery.showImage(${index})"
                                 data-category="${img.category}">
                                <img src="${img.url}" alt="${img.title}">
                                <div class="thumbnail-overlay">
                                    <span class="category-tag">${this.getCategoryIcon(img.category)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="gallery-controls">
                    <div class="filter-buttons">
                        <button class="filter-btn active" onclick="window.vehicleGallery.filterByCategory('all')">
                            📷 Todas
                        </button>
                        <button class="filter-btn" onclick="window.vehicleGallery.filterByCategory('exterior')">
                            🚗 Exterior
                        </button>
                        <button class="filter-btn" onclick="window.vehicleGallery.filterByCategory('interior')">
                            🪑 Interior
                        </button>
                        <button class="filter-btn" onclick="window.vehicleGallery.filterByCategory('technical')">
                            🔧 Técnico
                        </button>
                    </div>

                    <div class="gallery-actions">
                        <button class="action-btn-small" onclick="window.vehicleGallery.toggleFullscreen()">
                            🖼️ Pantalla Completa
                        </button>
                        <button class="action-btn-small" onclick="window.vehicleGallery.downloadImage()">
                            ⬇️ Descargar
                        </button>
                        <button class="action-btn-small" onclick="window.vehicleGallery.shareImage()">
                            📤 Compartir
                        </button>
                        <button class="action-btn-small" onclick="window.vehicleGallery.startSlideshow()">
                            ▶️ Slideshow
                        </button>
                    </div>
                </div>

                <div class="gallery-specs">
                    <h3>🔍 Especificaciones del Vehículo</h3>
                    <div class="specs-grid">
                        <div class="spec-item">
                            <span class="spec-label">Modelo</span>
                            <span class="spec-value">${this.currentVehicle.model}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Año</span>
                            <span class="spec-value">${this.currentVehicle.year}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Color</span>
                            <span class="spec-value">${this.currentVehicle.color}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Precio</span>
                            <span class="spec-value">$${this.currentVehicle.price?.toLocaleString()}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Combustible</span>
                            <span class="spec-value">${this.currentVehicle.fuel_type || 'Gasolina'}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Transmisión</span>
                            <span class="spec-value">${this.currentVehicle.transmission || 'Automática'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupGalleryEvents();
    }

    setupGalleryEvents() {
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
        
        // Touch/swipe support for mobile
        let startX = 0;
        const mainImage = document.getElementById('mainGalleryImage');
        
        mainImage.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        mainImage.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.nextImage();
                } else {
                    this.previousImage();
                }
            }
        });
    }

    handleKeyboard(e) {
        if (!document.getElementById('vehicleGalleryModal')) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                this.previousImage();
                break;
            case 'ArrowRight':
                this.nextImage();
                break;
            case 'Escape':
                document.getElementById('vehicleGalleryModal').remove();
                break;
            case 'f':
            case 'F':
                this.toggleFullscreen();
                break;
            case ' ':
                e.preventDefault();
                this.startSlideshow();
                break;
        }
    }

    showImage(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentImageIndex = index;
        const image = this.images[index];
        
        const mainImg = document.getElementById('mainGalleryImage');
        const overlay = document.querySelector('.image-overlay');
        
        // Fade effect
        mainImg.style.opacity = '0.3';
        setTimeout(() => {
            mainImg.src = image.url;
            mainImg.alt = image.title;
            overlay.querySelector('.image-title').textContent = image.title;
            overlay.querySelector('.image-counter').textContent = `${index + 1} / ${this.images.length}`;
            mainImg.style.opacity = '1';
        }, 150);
        
        // Update thumbnails
        document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }

    nextImage() {
        const nextIndex = (this.currentImageIndex + 1) % this.images.length;
        this.showImage(nextIndex);
    }

    previousImage() {
        const prevIndex = (this.currentImageIndex - 1 + this.images.length) % this.images.length;
        this.showImage(prevIndex);
    }

    filterByCategory(category) {
        const thumbnails = document.querySelectorAll('.thumbnail');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        // Update filter buttons
        filterButtons.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Show/hide thumbnails
        thumbnails.forEach(thumb => {
            const thumbCategory = thumb.dataset.category;
            if (category === 'all' || thumbCategory === category) {
                thumb.style.display = 'block';
            } else {
                thumb.style.display = 'none';
            }
        });
    }

    getCategoryIcon(category) {
        const icons = {
            exterior: '🚗',
            interior: '🪑',
            technical: '🔧',
            detail: '🔍'
        };
        return icons[category] || '📷';
    }

    toggleFullscreen() {
        const modal = document.getElementById('vehicleGalleryModal');
        if (modal) {
            modal.classList.toggle('fullscreen');
            const btn = event.target;
            btn.textContent = modal.classList.contains('fullscreen') ? '🔲 Salir' : '🖼️ Pantalla Completa';
        }
    }

    downloadImage() {
        const currentImage = this.images[this.currentImageIndex];
        const link = document.createElement('a');
        link.href = currentImage.url;
        link.download = `${this.currentVehicle.model}_${currentImage.title}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Imagen descargada', 'success');
    }

    shareImage() {
        const currentImage = this.images[this.currentImageIndex];
        const shareData = {
            title: `${this.currentVehicle.model} - ${currentImage.title}`,
            text: `Mira esta imagen de ${this.currentVehicle.model}`,
            url: currentImage.url
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(currentImage.url);
            this.showNotification('Enlace copiado al portapapeles', 'info');
        }
    }

    startSlideshow() {
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
            event.target.textContent = '▶️ Slideshow';
            return;
        }
        
        event.target.textContent = '⏸️ Pausar';
        this.slideshowInterval = setInterval(() => {
            this.nextImage();
        }, 3000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `gallery-notification alert-${type}`;
        notification.textContent = message;
        
        const modal = document.getElementById('vehicleGalleryModal');
        if (modal) {
            modal.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }

    // Integration with vehicle management
    static addToVehicleCard(vehicleCard, vehicleData) {
        const galleryBtn = document.createElement('button');
        galleryBtn.className = 'btn btn-gallery';
        galleryBtn.innerHTML = '📷 Ver Galería';
        galleryBtn.onclick = () => window.vehicleGallery.openGallery(vehicleData);
        
        const actionsDiv = vehicleCard.querySelector('.vehicle-actions') || 
                          vehicleCard.querySelector('.actions') ||
                          vehicleCard;
        
        if (actionsDiv) {
            actionsDiv.appendChild(galleryBtn);
        }
    }
}

// Initialize gallery
window.vehicleGallery = new BMWVehicleGallery();

// Add global function for easy access
window.openVehicleGallery = (vehicleData) => window.vehicleGallery.openGallery(vehicleData);