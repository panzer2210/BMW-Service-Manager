class BMWFinanceCalculator {
    constructor() {
        this.currentVehicle = null;
        this.calculations = [];
    }

    openCalculator(vehicleData = null) {
        this.currentVehicle = vehicleData;
        this.createCalculatorModal();
    }

    createCalculatorModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.id = 'financeCalculatorModal';

        modal.innerHTML = `
            <div class="modal-content calculator-modal">
                <span class="close" onclick="document.getElementById('financeCalculatorModal').remove()">&times;</span>
                <div class="calculator-header">
                    <h2>💰 Calculadora de Financiamiento BMW</h2>
                    <p>Calcula tus opciones de financiamiento para vehículos BMW</p>
                </div>
                
                <div class="calculator-grid">
                    <div class="calculator-inputs">
                        <div class="form-group">
                            <label>Precio del Vehículo ($)</label>
                            <input type="number" id="vehiclePrice" class="form-control calculator-input" 
                                   value="${this.currentVehicle ? this.currentVehicle.price : ''}" 
                                   placeholder="Ej: 65000">
                        </div>
                        
                        <div class="form-group">
                            <label>Inicial (RD$)</label>
                            <input type="number" id="downPayment" class="form-control calculator-input" 
                                   placeholder="Ej: 500000">
                            <small>Recomendado: 20% del precio</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Tasa de Interés Anual (%)</label>
                            <input type="number" id="interestRate" class="form-control calculator-input" 
                                   value="4.9" step="0.1" placeholder="Ej: 4.9">
                            <small>Tasa BMW típica: 3.9% - 7.9%</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Plazo (meses)</label>
                            <select id="loanTerm" class="form-control calculator-input">
                                <option value="24">24 meses</option>
                                <option value="36" selected>36 meses</option>
                                <option value="48">48 meses</option>
                                <option value="60">60 meses</option>
                                <option value="72">72 meses</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Valor de intercambio ($)</label>
                            <input type="number" id="tradeValue" class="form-control calculator-input" 
                                   placeholder="Valor de tu auto actual">
                        </div>
                        
                        <button type="button" class="btn btn-success" onclick="window.financeCalculator.calculate()">
                            🧮 Calcular Financiamiento
                        </button>
                    </div>
                    
                    <div class="calculator-results">
                        <div class="results-card">
                            <h3>📊 Resumen del Financiamiento</h3>
                            <div id="calculatorResults">
                                <div class="result-placeholder">
                                    Completa los datos para ver los resultados
                                </div>
                            </div>
                        </div>
                        
                        <div class="results-card">
                            <h3>📈 Comparación de Plazos</h3>
                            <div id="termComparison">
                                <canvas id="comparisonChart" width="300" height="200"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="calculator-footer">
                    <div class="bmw-offers">
                        <h4>🎯 Ofertas BMW Actuales</h4>
                        <div class="offers-grid">
                            <div class="offer-card">
                                <strong>BMW i4</strong>
                                <p>Desde 2.9% APR*</p>
                                <span>*Con crédito calificado</span>
                            </div>
                            <div class="offer-card">
                                <strong>BMW X Series</strong>
                                <p>$1,000 Cash Back</p>
                                <span>*En modelos selectos</span>
                            </div>
                            <div class="offer-card">
                                <strong>BMW M Series</strong>
                                <p>0.9% APR x 36 meses</p>
                                <span>*Financiamiento especial</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        this.setupCalculatorEvents();
        
        // Auto-calculate if vehicle data is provided
        if (this.currentVehicle) {
            setTimeout(() => this.calculate(), 500);
        }
    }

    setupCalculatorEvents() {
        const inputs = document.querySelectorAll('.calculator-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(this.calculateTimeout);
                this.calculateTimeout = setTimeout(() => this.calculate(), 300);
            });
        });

        // Auto-fill down payment recommendation
        const priceInput = document.getElementById('vehiclePrice');
        const downPaymentInput = document.getElementById('downPayment');
        
        priceInput.addEventListener('input', () => {
            const price = parseFloat(priceInput.value);
            if (price) {
                const recommendedDown = Math.round(price * 0.2);
                downPaymentInput.placeholder = `Recomendado: $${recommendedDown.toLocaleString()}`;
            }
        });
    }

    calculate() {
        const vehiclePrice = parseFloat(document.getElementById('vehiclePrice').value) || 0;
        const downPayment = parseFloat(document.getElementById('downPayment').value) || 0;
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const loanTerm = parseInt(document.getElementById('loanTerm').value) || 36;
        const tradeValue = parseFloat(document.getElementById('tradeValue').value) || 0;

        if (!vehiclePrice) {
            document.getElementById('calculatorResults').innerHTML = 
                '<div class="result-placeholder">Ingresa el precio del vehículo</div>';
            return;
        }

        const loanAmount = vehiclePrice - downPayment - tradeValue;
        const monthlyRate = interestRate / 100 / 12;
        const monthlyPayment = this.calculateMonthlyPayment(loanAmount, monthlyRate, loanTerm);
        const totalAmount = monthlyPayment * loanTerm;
        const totalInterest = totalAmount - loanAmount;

        this.displayResults({
            vehiclePrice,
            downPayment,
            tradeValue,
            loanAmount,
            monthlyPayment,
            totalAmount,
            totalInterest,
            interestRate,
            loanTerm
        });

        this.createComparisonChart(loanAmount, interestRate);
    }

    calculateMonthlyPayment(principal, monthlyRate, months) {
        if (monthlyRate === 0) return principal / months;
        return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
               (Math.pow(1 + monthlyRate, months) - 1);
    }

    displayResults(data) {
        const resultsDiv = document.getElementById('calculatorResults');
        
        resultsDiv.innerHTML = `
            <div class="calculation-grid">
                <div class="calc-item primary">
                    <div class="calc-label">Pago Mensual</div>
                    <div class="calc-value">$${data.monthlyPayment.toFixed(2)}</div>
                </div>
                
                <div class="calc-item">
                    <div class="calc-label">Monto del Préstamo</div>
                    <div class="calc-value">$${data.loanAmount.toLocaleString()}</div>
                </div>
                
                <div class="calc-item">
                    <div class="calc-label">Interés Total</div>
                    <div class="calc-value">$${data.totalInterest.toFixed(2)}</div>
                </div>
                
                <div class="calc-item">
                    <div class="calc-label">Costo Total</div>
                    <div class="calc-value">$${data.totalAmount.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="payment-breakdown">
                <h4>Desglose de Pagos</h4>
                <div class="breakdown-bar">
                    <div class="breakdown-segment principal" 
                         style="width: ${(data.loanAmount / data.totalAmount * 100)}%">
                        <span>Capital</span>
                    </div>
                    <div class="breakdown-segment interest" 
                         style="width: ${(data.totalInterest / data.totalAmount * 100)}%">
                        <span>Intereses</span>
                    </div>
                </div>
                <div class="breakdown-legend">
                    <div class="legend-item">
                        <div class="legend-color principal"></div>
                        <span>Capital: $${data.loanAmount.toLocaleString()}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color interest"></div>
                        <span>Intereses: $${data.totalInterest.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-success" onclick="window.financeCalculator.saveCalculation()">
                    💾 Guardar Cálculo
                </button>
                <button class="btn" onclick="window.financeCalculator.shareCalculation()">
                    📧 Compartir
                </button>
                <button class="btn" onclick="window.financeCalculator.printCalculation()">
                    🖨️ Imprimir
                </button>
            </div>
        `;
    }

    createComparisonChart(loanAmount, interestRate) {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const terms = [24, 36, 48, 60, 72];
        const monthlyRate = interestRate / 100 / 12;
        
        const data = terms.map(term => ({
            term,
            payment: this.calculateMonthlyPayment(loanAmount, monthlyRate, term),
            total: this.calculateMonthlyPayment(loanAmount, monthlyRate, term) * term
        }));

        this.drawComparisonChart(ctx, data, canvas.width, canvas.height);
    }

    drawComparisonChart(ctx, data, width, height) {
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        const barWidth = chartWidth / data.length - 10;
        const maxPayment = Math.max(...data.map(d => d.payment));

        // Set colors based on theme
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const primaryColor = isDark ? '#00D4FF' : '#1e3c72';
        const textColor = isDark ? '#ffffff' : '#333333';

        data.forEach((item, index) => {
            const barHeight = (item.payment / maxPayment) * chartHeight;
            const x = padding + index * (barWidth + 10);
            const y = height - padding - barHeight;

            // Draw bar
            ctx.fillStyle = primaryColor;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw term label
            ctx.fillStyle = textColor;
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${item.term}m`, x + barWidth / 2, height - 10);

            // Draw payment value
            ctx.fillText(`$${Math.round(item.payment)}`, x + barWidth / 2, y - 5);
        });

        // Draw title
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Pagos Mensuales por Plazo', width / 2, 20);
    }

    saveCalculation() {
        // Save calculation to local storage
        const calculation = this.getCurrentCalculation();
        const saved = JSON.parse(localStorage.getItem('bmw-calculations') || '[]');
        saved.push({ ...calculation, id: Date.now(), date: new Date().toISOString() });
        localStorage.setItem('bmw-calculations', JSON.stringify(saved));
        
        // Add to recent activity if dashboard is available
        if (window.bmwDashboard) {
            const monthlyPayment = this.calculateMonthlyPayment(
                calculation.vehiclePrice - calculation.downPayment - calculation.tradeValue,
                calculation.interestRate / 100 / 12,
                calculation.loanTerm
            );
            window.bmwDashboard.addActivity('💰', 'Cálculo de financiamiento', 
                `Pago mensual calculado: $${monthlyPayment.toFixed(2)}`);
        }
        
        this.showNotification('Cálculo guardado exitosamente', 'success');
    }

    shareCalculation() {
        const calculation = this.getCurrentCalculation();
        const shareText = `
            BMW Finance Calculator Results:
            Vehicle Price: $${calculation.vehiclePrice.toLocaleString()}
            Monthly Payment: $${calculation.monthlyPayment.toFixed(2)}
            Loan Term: ${calculation.loanTerm} months
            Interest Rate: ${calculation.interestRate}%
        `;
        
        if (navigator.share) {
            navigator.share({ title: 'BMW Finance Calculation', text: shareText });
        } else {
            navigator.clipboard.writeText(shareText);
            this.showNotification('Resultados copiados al portapapeles', 'info');
        }
    }

    printCalculation() {
        const calculation = this.getCurrentCalculation();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>BMW Finance Calculator - Results</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                        .result-item { padding: 10px; border: 1px solid #ccc; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🚗 BMW Finance Calculator</h1>
                        <p>Calculation Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="result-grid">
                        <div class="result-item">
                            <strong>Vehicle Price:</strong> $${calculation.vehiclePrice.toLocaleString()}
                        </div>
                        <div class="result-item">
                            <strong>Down Payment:</strong> $${calculation.downPayment.toLocaleString()}
                        </div>
                        <div class="result-item">
                            <strong>Monthly Payment:</strong> $${calculation.monthlyPayment.toFixed(2)}
                        </div>
                        <div class="result-item">
                            <strong>Loan Term:</strong> ${calculation.loanTerm} months
                        </div>
                        <div class="result-item">
                            <strong>Interest Rate:</strong> ${calculation.interestRate}%
                        </div>
                        <div class="result-item">
                            <strong>Total Cost:</strong> $${calculation.totalAmount.toFixed(2)}
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    getCurrentCalculation() {
        return {
            vehiclePrice: parseFloat(document.getElementById('vehiclePrice').value) || 0,
            downPayment: parseFloat(document.getElementById('downPayment').value) || 0,
            interestRate: parseFloat(document.getElementById('interestRate').value) || 0,
            loanTerm: parseInt(document.getElementById('loanTerm').value) || 36,
            tradeValue: parseFloat(document.getElementById('tradeValue').value) || 0,
            monthlyPayment: 0, // Will be calculated
            totalAmount: 0, // Will be calculated
        };
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            min-width: 300px;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
}

// Initialize calculator
window.financeCalculator = new BMWFinanceCalculator();

// Add to global BMW utilities
window.openCalculator = () => window.financeCalculator.openCalculator();