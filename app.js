document.addEventListener('DOMContentLoaded', () => {
    // --- State & Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Resizer Elements
    const resizerZone = document.getElementById('resizer-drop-zone');
    const resizerInput = document.getElementById('resizer-input');
    const resizerWorkspace = document.getElementById('resizer-workspace');
    const imgPreview = document.getElementById('image-preview');
    const originalInfoStr = document.getElementById('original-info');
    const inputWidth = document.getElementById('resize-width');
    const inputHeight = document.getElementById('resize-height');
    const lockRatio = document.getElementById('lock-ratio');
    const inputQuality = document.getElementById('resize-quality');
    const qualityVal = document.getElementById('quality-value');
    const downloadBtn = document.getElementById('download-btn');

    // Fixer Elements
    const fixerZone = document.getElementById('fixer-drop-zone');
    const fixerInput = document.getElementById('fixer-input');
    const fixerWorkspace = document.getElementById('fixer-workspace');
    const detectedFormatEl = document.getElementById('detected-format');
    const fixerMessageEl = document.getElementById('fixer-message');
    const fixerIconEl = document.getElementById('fixer-icon');
    const fixDownloadBtn = document.getElementById('fix-download-btn');

    let currentFile = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let currentAspectRatio = 0;

    // --- Tab Switching ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- Image Resizer Logic ---
    resizerZone.addEventListener('click', () => resizerInput.click());
    resizerInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));

    // Drag & Drop
    setupDragDrop(resizerZone, handleImageUpload);

    function handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;
        currentFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imgPreview.src = e.target.result;
            imgPreview.onload = () => {
                originalWidth = imgPreview.naturalWidth;
                originalHeight = imgPreview.naturalHeight;
                currentAspectRatio = originalWidth / originalHeight;

                inputWidth.value = originalWidth;
                inputHeight.value = originalHeight;
                originalInfoStr.textContent = `Original: ${originalWidth} x ${originalHeight} (${(file.size / 1024).toFixed(1)} KB)`;

                resizerZone.classList.add('hidden');
                resizerWorkspace.classList.remove('hidden');
            };
        };
        reader.readAsDataURL(file);
    }

    // Resize Inputs
    inputWidth.addEventListener('input', () => {
        if (lockRatio.checked && inputWidth.value) {
            inputHeight.value = Math.round(inputWidth.value / currentAspectRatio);
        }
    });

    inputHeight.addEventListener('input', () => {
        if (lockRatio.checked && inputHeight.value) {
            inputWidth.value = Math.round(inputHeight.value * currentAspectRatio);
        }
    });

    inputQuality.addEventListener('input', (e) => {
        qualityVal.textContent = e.target.value;
    });

    // Download Resized
    downloadBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = parseInt(inputWidth.value);
        const h = parseInt(inputHeight.value);

        canvas.width = w;
        canvas.height = h;

        // Draw and resize
        ctx.drawImage(imgPreview, 0, 0, w, h);

        const quality = parseFloat(inputQuality.value);
        const format = currentFile.type || 'image/jpeg';

        const dataUrl = canvas.toDataURL(format, quality);

        const link = document.createElement('a');
        link.download = `resized-${currentFile.name}`;
        link.href = dataUrl;
        link.click();
    });


    // --- File Extension Fixer Logic ---
    fixerZone.addEventListener('click', () => fixerInput.click());
    fixerInput.addEventListener('change', (e) => handleFixerUpload(e.target.files[0]));
    setupDragDrop(fixerZone, handleFixerUpload);

    let fixedBlob = null;
    let fixedExtension = '';

    function handleFixerUpload(file) {
        if (!file) return;

        fixerZone.classList.add('hidden');
        fixerWorkspace.classList.remove('hidden');
        fixerMessageEl.textContent = "Analyzing magic bytes...";

        const reader = new FileReader();
        reader.onload = (e) => {
            const arr = (new Uint8Array(e.target.result)).subarray(0, 12);
            let header = "";
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16).toUpperCase();
            }

            identifyFile(header, file);
        };
        reader.readAsArrayBuffer(file);
    }

    function identifyFile(header, file) {
        let ext = null;
        let mime = '';
        let typeName = 'Unknown';
        let icon = '❓';

        // Magic Bytes Database
        if (header.startsWith("FFD8FF")) { ext = "jpg"; mime = "image/jpeg"; typeName = "JPEG Image"; icon = "🖼️"; }
        else if (header.startsWith("89504E47")) { ext = "png"; mime = "image/png"; typeName = "PNG Image"; icon = "🖼️"; }
        else if (header.startsWith("47494638")) { ext = "gif"; mime = "image/gif"; typeName = "GIF Image"; icon = "👾"; }
        else if (header.startsWith("25504446")) { ext = "pdf"; mime = "application/pdf"; typeName = "PDF Document"; icon = "📄"; }
        else if (header.startsWith("504B0304")) { ext = "zip"; mime = "application/zip"; typeName = "ZIP/Office File"; icon = "📦"; } // Covers docx, xlsx, zip
        else if (header.startsWith("52617221")) { ext = "rar"; mime = "application/x-rar-compressed"; typeName = "RAR Archive"; icon = "📦"; }
        else if (header.startsWith("494433")) { ext = "mp3"; mime = "audio/mpeg"; typeName = "MP3 Audio"; icon = "🎵"; }
        else if (header.startsWith("00000018") || header.startsWith("00000020") || header.startsWith("66747970")) { ext = "mp4"; mime = "video/mp4"; typeName = "MP4 Video"; icon = "🎬"; }

        // Logic for Office files (ZIP based) - simple heuristic, can improve later
        if (ext === 'zip') {
            // For now defaults to zip/docx, simplistic approach
            typeName = "ZIP or Office Document (docx/xlsx)";
            // We'll default to zip safe
        }

        if (ext) {
            detectedFormatEl.textContent = typeName;
            fixerMessageEl.textContent = `Identified as .${ext}`;
            fixerIconEl.textContent = icon;

            fixedExtension = ext;
            fixedBlob = file.slice(0, file.size, mime);

            fixDownloadBtn.classList.remove('hidden');
            fixDownloadBtn.textContent = `Download as .${ext}`;
        } else {
            detectedFormatEl.textContent = "Unknown Format";
            fixerMessageEl.textContent = "Could not verify signature. Header: " + header.substring(0, 8);
            fixDownloadBtn.classList.add('hidden');
        }
    }

    fixDownloadBtn.addEventListener('click', () => {
        if (!fixedBlob) return;
        const link = document.createElement('a');
        const originalName = fixerInput.files[0]?.name || "file";
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");

        link.download = `${nameWithoutExt}.${fixedExtension}`;
        link.href = URL.createObjectURL(fixedBlob);
        link.click();
    });

    // --- Shared Utilities ---
    function setupDragDrop(element, callback) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('dragover');
        });
        element.addEventListener('dragleave', () => {
            element.classList.remove('dragover');
        });
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                callback(e.dataTransfer.files[0]);
            }
        });
    }
});
