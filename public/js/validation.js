function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidVIN(vin) {
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(vin);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function showFieldError(fieldId, message) {
    const errorDiv = document.getElementById(fieldId + '-error');
    const field = document.getElementById(fieldId);
    
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '14px';
        errorDiv.style.marginTop = '5px';
        errorDiv.style.display = 'block';
    }
    
    if (field) {
        field.style.borderColor = '#dc3545';
        field.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.1)';
    }
}

function clearErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => {
        error.textContent = '';
        error.style.display = 'none';
    });
    
    const formControls = document.querySelectorAll('.form-control');
    formControls.forEach(control => {
        control.style.borderColor = '#e1e5e9';
        control.style.boxShadow = 'none';
    });
}

function showAlert(message, type = 'danger') {
    const alertsContainer = document.getElementById('alerts');
    if (!alertsContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertsContainer.innerHTML = '';
    alertsContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function validateRequired(value, fieldName) {
    if (!value || value.trim() === '') {
        return `${fieldName} es requerido`;
    }
    return null;
}

function validateMinLength(value, minLength, fieldName) {
    if (value && value.length < minLength) {
        return `${fieldName} debe tener al menos ${minLength} caracteres`;
    }
    return null;
}

function validateMaxLength(value, maxLength, fieldName) {
    if (value && value.length > maxLength) {
        return `${fieldName} no puede exceder ${maxLength} caracteres`;
    }
    return null;
}

function validateNumber(value, fieldName, min = null, max = null) {
    if (value && isNaN(value)) {
        return `${fieldName} debe ser un número válido`;
    }
    
    const numValue = parseFloat(value);
    if (min !== null && numValue < min) {
        return `${fieldName} debe ser mayor o igual a ${min}`;
    }
    
    if (max !== null && numValue > max) {
        return `${fieldName} debe ser menor o igual a ${max}`;
    }
    
    return null;
}

function validateYear(year) {
    const currentYear = new Date().getFullYear();
    const numYear = parseInt(year);
    
    if (isNaN(numYear)) {
        return 'El año debe ser un número válido';
    }
    
    if (numYear < 1990) {
        return 'El año debe ser mayor o igual a 1990';
    }
    
    if (numYear > currentYear + 1) {
        return `El año no puede ser mayor a ${currentYear + 1}`;
    }
    
    return null;
}

function validatePrice(price) {
    const numPrice = parseFloat(price);
    
    if (isNaN(numPrice)) {
        return 'El precio debe ser un número válido';
    }
    
    if (numPrice < 0) {
        return 'El precio no puede ser negativo';
    }
    
    if (numPrice > 1000000) {
        return 'El precio no puede exceder $1,000,000';
    }
    
    return null;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showFlashMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');
    
    if (error) {
        showError(decodeURIComponent(error));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (success) {
        showSuccess(decodeURIComponent(success));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function sanitizeInput(input) {
    return input.replace(/[<>\"']/g, '');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}