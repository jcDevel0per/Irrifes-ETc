document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tmaxInput = document.getElementById('tmax');
    const tminInput = document.getElementById('tmin');
    const raInput = document.getElementById('ra-input'); // New Ra input
    const cropSelectorTrigger = document.getElementById('crop-selector-trigger');
    const cropSelectionPanel = document.getElementById('crop-selection-panel');
    const cropSelectionGrid = document.getElementById('crop-selection-grid');
    const cropStageSelect = document.getElementById('crop-stage');
    const rainfallInput = document.getElementById('rainfall');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultDiv = document.getElementById('result');
    const resultText = document.getElementById('result-text');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const autoModeStatus = document.getElementById('auto-mode-status');
    const tmedDisplay = document.getElementById('tmed-display');

    // --- Function Definitions ---

    function updateStatus(message, isError = false) {
        autoModeStatus.textContent = message;
        autoModeStatus.classList.remove('hidden');
        autoModeStatus.style.backgroundColor = isError ? '#f8d7da' : '#e6f4e7';
    }

    function updateTmedDisplay() {
        const tmax = parseFloat(tmaxInput.value);
        const tmin = parseFloat(tminInput.value);
        if (!isNaN(tmax) && !isNaN(tmin)) {
            const tmed = (tmax + tmin) / 2;
            tmedDisplay.textContent = tmed.toFixed(2);
        } else {
            tmedDisplay.textContent = '--';
        }
    }

    function toggleInputs(disabled) {
        tmaxInput.disabled = disabled;
        tminInput.disabled = disabled;
        raInput.disabled = disabled; // Manage new Ra input
    }

    function handleManualMode() {
        toggleInputs(false);
        autoModeStatus.classList.add('hidden');
        updateTmedDisplay();
        resultDiv.classList.add('hidden'); // Hide result on mode change
    }

    function handleAutoMode() {
        updateStatus('Obtendo sua localização...');
        resultDiv.classList.add('hidden'); // Hide result on mode change
        if (!navigator.geolocation) {
            updateStatus('Geolocalização não é suportada pelo seu navegador.', true);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                updateStatus('Localização obtida! Buscando dados do tempo...');
                fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
                updateStatus('Permissão de localização negada. Por favor, habilite para usar o modo automático.', true);
                document.querySelector('input[value="manual"]').checked = true; // Revert to manual
            }
        );
    }

    function fetchWeatherData(lat, lon) {
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,precipitation_sum&timezone=auto`;
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.daily) {
                    tmaxInput.value = data.daily.temperature_2m_max[0];
                    tminInput.value = data.daily.temperature_2m_min[0];
                    rainfallInput.value = data.daily.precipitation_sum[0];
                    raInput.value = data.daily.shortwave_radiation_sum[0].toFixed(2);
                    toggleInputs(true);
                    updateStatus(`Dados para ${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)} carregados.`);
                    updateTmedDisplay();
                } else {
                    throw new Error('Dados do tempo não encontrados na resposta da API.');
                }
            })
            .catch(() => {
                updateStatus('Falha ao buscar dados do tempo. Tente novamente.', true);
                document.querySelector('input[value="manual"]').checked = true; // Revert to manual
            }
        );
    }

    // --- Event Listeners ---

    tmaxInput.addEventListener('input', updateTmedDisplay);
    tminInput.addEventListener('input', updateTmedDisplay);

    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'auto') {
                handleAutoMode();
            } else {
                handleManualMode();
            }
        });
    });

    // Logic for crop selection UI
    // New: Search input for crops
    const cropSearchInput = document.createElement('input');
    cropSearchInput.type = 'text';
    cropSearchInput.id = 'crop-search-input';
    cropSearchInput.placeholder = 'Buscar cultura...';
    cropSelectionPanel.prepend(cropSearchInput); // Add search input at the top of the panel

    function filterAndRenderCrops(searchTerm = '') {
        cropSelectionGrid.innerHTML = ''; // Clear current grid
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        const filteredCropKeys = Object.keys(cropData).filter(key => 
            cropData[key].label.toLowerCase().includes(lowerCaseSearchTerm)
        );

        filteredCropKeys.forEach(cropKey => {
            const card = document.createElement('div');
            card.className = 'crop-card';
            card.dataset.cropKey = cropKey;
            card.innerHTML = `<span class="label">${cropData[cropKey].label}</span>`; // Corrected typo here
            cropSelectionGrid.appendChild(card);
        });

        // Re-select the previously selected crop if it's still in the filtered list
        const currentSelectedCropKey = cropSelectorTrigger.dataset.selectedCropKey;
        if (currentSelectedCropKey) {
            const previouslySelectedCard = cropSelectionGrid.querySelector(`[data-crop-key="${currentSelectedCropKey}"]`);
            if (previouslySelectedCard) {
                previouslySelectedCard.classList.add('selected');
            }
        }
    }

    // Initial render of crops
    filterAndRenderCrops();

    cropSearchInput.addEventListener('input', (e) => {
        filterAndRenderCrops(e.target.value);
    });

    cropSelectorTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        cropSelectionPanel.classList.toggle('visible');
    });
    document.addEventListener('click', (e) => {
        if (!cropSelectorTrigger.contains(e.target) && !cropSelectionPanel.contains(e.target)) {
            cropSelectionPanel.classList.remove('visible');
        }
    });

    cropSelectionGrid.addEventListener('click', (e) => {
        const clickedCard = e.target.closest('.crop-card');
        if (!clickedCard) return;
        const selectedCropKey = clickedCard.dataset.cropKey;
        const selectedCrop = cropData[selectedCropKey];

        cropSelectorTrigger.innerHTML = `<span>${selectedCrop.label}</span>`; // Removed icon
        cropSelectorTrigger.dataset.selectedCropKey = selectedCropKey; // Store selected key
        cropSelectionPanel.classList.remove('visible');

        cropStageSelect.innerHTML = '<option value="">-- Selecione a Fase --</option>';
        cropStageSelect.disabled = false;
        for (const stageKey in selectedCrop.stages) {
            const option = document.createElement('option');
            const stage = selectedCrop.stages[stageKey];
            option.value = stage.kc;
            option.textContent = `${stage.label} (Kc: ${stage.kc})`;
            cropStageSelect.appendChild(option);
        }
        document.querySelectorAll('.crop-card').forEach(card => card.classList.remove('selected'));
        clickedCard.classList.add('selected');
    });

    // --- Calculation Logic ---
    calculateBtn.addEventListener('click', () => {
        const tmax = parseFloat(tmaxInput.value);
        const tmin = parseFloat(tminInput.value);
        const kc = parseFloat(cropStageSelect.value);
        const rain = parseFloat(rainfallInput.value) || 0;
        const ra = parseFloat(raInput.value);

        if (isNaN(tmax) || isNaN(tmin) || isNaN(ra)) {
            alert('Por favor, preencha todos os campos de temperatura e radiação solar.');
            return;
        }
        if (isNaN(kc)) {
            alert('Por favor, selecione a cultura e a sua fase de desenvolvimento.');
            return;
        }

        const tmed = (tmax + tmin) / 2;
        const eto = 0.0023 * ra * (tmed + 17.8) * Math.sqrt(tmax - tmin);
        const etc = eto * kc;
        const finalNeed = etc - rain;

        let formulaDisplay = `
            <h3>Fórmula Utilizada:</h3>
            <p><strong>ETo (Evapotranspiração de Referência)</strong></p>
            <p>ETo = 0.0023 * Ra * (Tmed + 17.8) * (Tmax - Tmin)^0.5</p>
            <p>ETo = 0.0023 * ${ra.toFixed(2)} * (${tmed.toFixed(2)} + 17.8) * (${tmax.toFixed(2)} - ${tmin.toFixed(2)})^0.5</p>
            <p>ETo = ${eto.toFixed(2)} mm</p>
            <br>
            <p><strong>ETc (Evapotranspiração da Cultura)</strong></p>
            <p>ETc = ETo * Kc</p>
            <p>ETc = ${eto.toFixed(2)} * ${kc.toFixed(2)}</p>
            <p>ETc = ${etc.toFixed(2)} mm</p>
            <hr>
        `;

        let resultHTML = `
            ${formulaDisplay}
            <p>Necessidade da planta (ETc): <strong>${etc.toFixed(2)} mm</strong></p>
            <p>Chuva registrada: <strong>${rain.toFixed(2)} mm</strong></p>
            <hr>
        `;
        if (finalNeed <= 0) {
            resultHTML += `<p><strong>Não é necessário irrigar.</strong> A chuva de hoje supriu a necessidade da planta.</p>`;
        } else {
            resultHTML += `<p>Irrigação necessária: <strong>${finalNeed.toFixed(2)} mm</strong></p><small>(Equivale a ${finalNeed.toFixed(2)} litros por metro quadrado)</small>`;
        }

        resultText.innerHTML = resultHTML;
        resultDiv.classList.remove('hidden');
    });
});