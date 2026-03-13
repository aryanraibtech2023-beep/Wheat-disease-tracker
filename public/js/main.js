document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const uploadInitial = document.getElementById('uploadInitial');
    const previewArea = document.getElementById('previewArea');
    const imagePreview = document.getElementById('imagePreview');
    const rescanBtn = document.getElementById('rescanBtn');
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingState = document.getElementById('loadingState');
    const resultsSection = document.getElementById('resultsSection');
    
    // Camera Elements
    const useCameraBtn = document.getElementById('useCameraBtn');
    const cameraView = document.getElementById('cameraView');
    const videoElement = document.getElementById('videoElement');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');

    // Results Elements
    const diseaseName = document.getElementById('diseaseName');
    const diseaseDesc = document.getElementById('diseaseDesc');
    const confidenceBadge = document.getElementById('confidenceBadge');
    const treatmentList = document.getElementById('treatmentList');

    let currentFile = null;
    let stream = null;

    // --- File Upload Logic ---
    uploadArea.addEventListener('click', (e) => {
        // Prevent click if clicking on inner buttons
        if(e.target.tagName === 'BUTTON' || e.target.closest('button')){
            return;
        }
        if (uploadInitial.classList.contains('hidden')) return;
        imageInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-dark)';
        uploadArea.style.background = 'rgba(255,255,255,0.7)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        uploadArea.style.background = 'rgba(255,255,255,0.4)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        uploadArea.style.background = 'rgba(255,255,255,0.4)';
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadInitial.classList.add('hidden');
            previewArea.classList.remove('hidden');
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    rescanBtn.addEventListener('click', () => {
        currentFile = null;
        imageInput.value = '';
        previewArea.classList.add('hidden');
        uploadInitial.classList.remove('hidden');
        analyzeBtn.disabled = true;
        resultsSection.classList.add('hidden');
    });

    // --- Camera Logic ---
    useCameraBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement.srcObject = stream;
            uploadInitial.classList.add('hidden');
            cameraView.classList.remove('hidden');
        } catch (err) {
            alert('Camera access denied or unavailable.');
            console.error(err);
        }
    });

    closeCameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopCamera();
        cameraView.classList.add('hidden');
        uploadInitial.classList.remove('hidden');
    });

    captureBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Draw video frame to canvas
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);
        
        // Convert to Blob/File
        canvas.toBlob((blob) => {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            stopCamera();
            cameraView.classList.add('hidden');
            handleFile(file);
        }, 'image/jpeg', 0.9);
    });

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    // --- Analysis API Logic ---
    analyzeBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        // UI State update
        analyzeBtn.disabled = true;
        loadingState.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        const formData = new FormData();
        formData.append('image', currentFile);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            loadingState.classList.add('hidden');
            analyzeBtn.disabled = false;

            if (result.success && result.data) {
                displayResults(result.data);
            } else {
                throw new Error(result.error || 'Failed to analyze image');
            }
            
        } catch (err) {
            console.error(err);
            loadingState.classList.add('hidden');
            analyzeBtn.disabled = false;
            alert('Error connecting to the AI diagnosis server. Ensure your backend is running with a valid Gemini API key.');
        }
    });

    function displayResults(data) {
        if(data.error) {
           diseaseName.textContent = "Error";
           diseaseName.style.color = "var(--danger)";
           diseaseDesc.textContent = "Could not parse AI response. " + (data.raw || "");
           treatmentList.innerHTML = "<li>Please try again later.</li>";
           confidenceBadge.textContent = "N/A confidence";
           resultsSection.classList.remove('hidden');
           return;
        }

        const isHealthy = data.diagnosis.toLowerCase().includes('healthy');
        
        diseaseName.textContent = data.diagnosis;
        diseaseName.className = 'disease-name ' + (isHealthy ? 'healthy' : '');
        confidenceBadge.textContent = data.confidence + ' Confidence';
        diseaseDesc.textContent = data.description || "No description provided.";
        
        treatmentList.innerHTML = '';
        if (data.treatment && data.treatment.length > 0) {
            data.treatment.forEach(tip => {
                const li = document.createElement('li');
                li.textContent = tip;
                treatmentList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = isHealthy ? "No treatment needed. Continue good farming practices." : "No specific treatments suggested.";
            treatmentList.appendChild(li);
        }

        resultsSection.classList.remove('hidden');
        // Scroll to results smoothly
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
