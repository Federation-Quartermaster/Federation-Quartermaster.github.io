// --- GLOBALS ---
let allAwardsData = [];
let selectedRack = [];
let activeSubFoldersOrder = [];

// Drag & Lock States
let isMedalsLocked = false;
let isRibbonsLocked = false;
let medalsOffsetX = 0, medalsOffsetY = 0;
let ribbonsOffsetX = 0, ribbonsOffsetY = 0;

// Camera Zoom/Pan Engine
let scale = 4;

// Replace with true fetch logic once bot json is complete
document.addEventListener("DOMContentLoaded", () => {
    // MOCK DATA FETCH (Simulating the new JSON structure)
    // Structure: id, name, category, branch, entity, tier, hasMedal, hasRibbon, ribbonImage, medalImage, precedence
    // Fetch logic will eventually go here:
    // fetch('awards.json').then(res => res.json()).then(data => { allAwardsData = data; buildExplorer(); });
});

// --- UI / LOGIC STATE ---
function updateTorsoBase() {
    const select = document.getElementById('torso-select');
    const upload = document.getElementById('torso-upload');
    if (select.value === 'custom') { upload.click(); } 
    else { document.getElementById('torso-img').src = select.value; }
}

function handleTorsoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('torso-img').src = e.target.result;
            document.getElementById('torso-select').options[1].text = "Custom Loaded"; 
        }
        reader.readAsDataURL(file);
    }
}

function toggleLock(category) {
    if (category === 'medals') {
        isMedalsLocked = !isMedalsLocked;
        const btn = document.getElementById('lock-medals-btn');
        btn.classList.toggle('tool-locked', isMedalsLocked);
        btn.innerHTML = isMedalsLocked ? '🔒 Medals Locked' : '🔓 Lock Medals';
    } else {
        isRibbonsLocked = !isRibbonsLocked;
        const btn = document.getElementById('lock-ribbons-btn');
        btn.classList.toggle('tool-locked', isRibbonsLocked);
        btn.innerHTML = isRibbonsLocked ? '🔒 Ribbons Locked' : '🔓 Lock Ribbons';
    }
    renderPreview();
}

function removeFromRack(id) {
    selectedRack = selectedRack.filter(a => a.id !== id);
    // Auto-uncheck UI
    const checkbox = document.getElementById(`chk_${id}`);
    if (checkbox) checkbox.checked = false;
    renderPreview();
}

// --- DYNAMIC RENDERING ALGORITHM (The Alignment Matrix) ---
function getGridLayout(index, totalItems, maxColumns) {
    const totalRows = Math.ceil(totalItems / maxColumns);
    const topRowCount = (totalItems % maxColumns === 0) ? maxColumns : (totalItems % maxColumns);
    let row, col, itemsInThisRow;

    if (index < topRowCount) {
        row = 0; // The highest, incomplete row
        col = index;
        itemsInThisRow = topRowCount;
    } else {
        const remainingIndex = index - topRowCount;
        row = 1 + Math.floor(remainingIndex / maxColumns);
        col = remainingIndex % maxColumns;
        itemsInThisRow = maxColumns;
    }
    return { row, col, itemsInThisRow, totalRows };
}

function renderPreview() {
    const ribbonsContainer = document.getElementById('ribbons-container');
    const citationsContainer = document.getElementById('citations-container');
    const medalsContainer = document.getElementById('medals-container');
    const badgesContainer = document.getElementById('badges-container');
    
    [ribbonsContainer, citationsContainer, medalsContainer, badgesContainer].forEach(c => c.innerHTML = '');

    const standardRibbons = selectedRack.filter(a => a.type === 'Ribbon' && !a.isCitation);
    const citations = selectedRack.filter(a => a.type === 'Citation' || a.isCitation);
    const medals = selectedRack.filter(a => a.type === 'Medal');
    const badges = selectedRack.filter(a => a.type === 'Badge');

    // Sort arrays by precedence logic here (Assuming ascending precedence = higher priority)
    [standardRibbons, citations, medals].forEach(arr => arr.sort((a, b) => a.precedence - b.precedence));

    // ==========================================
    // 🎛️ THE MATHEMATICAL MATRIX (Line Assignments)
    // ==========================================
    const hasRibbons = standardRibbons.length > 0;
    const hasMedals = medals.length > 0;

    // Anchor Centers (Horizontal)
    const LEFT_POCKET_CENTER_X = 28;  // Viewer's Left (Character Right)
    const RIGHT_POCKET_CENTER_X = 94; // Viewer's Right (Character Left)

    // Anchor Lines (Vertical Pixel Y-Coordinates)
    const RED_LINE_Y = 32;
    const YELLOW_LINE_Y = 32;
    const GREEN_LINE_Y = 34;
    const BLUE_LINE_Y = 34;

    // RULE 1: Ribbons sit on BLUE
    const RIBBON_LINE_Y = BLUE_LINE_Y;
    const RIBBON_CENTER_X = RIGHT_POCKET_CENTER_X;

    // RULE 2: Medals
    const MEDAL_LINE_Y = hasRibbons ? GREEN_LINE_Y : BLUE_LINE_Y;
    const MEDAL_CENTER_X = hasRibbons ? LEFT_POCKET_CENTER_X : RIGHT_POCKET_CENTER_X;
    const medalsOnGreen = (MEDAL_LINE_Y === GREEN_LINE_Y && hasMedals);

    // RULE 3: Citations
    const CITATION_LINE_Y = medalsOnGreen ? RED_LINE_Y : GREEN_LINE_Y;
    const CITATION_CENTER_X = LEFT_POCKET_CENTER_X;

    // --- RENDER STANDARD RIBBONS (Building UP) ---
    const ribbonWidth = 16;
    const ribbonHeight = 4;
    standardRibbons.forEach((ribbon, index) => {
        const img = document.createElement('img');
        img.src = ribbon.activeImage;
        img.className = 'rack-item ribbon-item';
        
        const { row, col, itemsInThisRow, totalRows } = getGridLayout(index, standardRibbons.length, 3);
        
        // Centering Math
        const rowWidth = itemsInThisRow * ribbonWidth;
        const startX = RIBBON_CENTER_X - (rowWidth / 2);
        const baseLeft = startX + (col * ribbonWidth);
        
        // Stack Upwards (row 0 is highest, so it needs the largest negative Y offset)
        const yOffset = (totalRows - 1 - row) * ribbonHeight;
        const baseTop = RIBBON_LINE_Y - ribbonHeight - yOffset;
        
        // Output
        img.style.left = `${baseLeft + ribbonsOffsetX}px`; 
        img.style.top = `${baseTop + ribbonsOffsetY}px`; 
        img.style.width = `${ribbonWidth}px`; 
        img.style.height = `${ribbonHeight}px`; 
        img.style.zIndex = 500 - index;
        
        if (isRibbonsLocked) makeCategoryDraggable(img, 'ribbons'); else img.ondblclick = () => removeFromRack(ribbon.id);
        ribbonsContainer.appendChild(img);
    });

    // --- RENDER CITATIONS (Building UP) ---
    const citationWidth = 12;
    const citationHeight = 4;
    citations.forEach((citation, index) => {
        const img = document.createElement('img');
        img.src = citation.activeImage;
        img.className = 'rack-item ribbon-item';
        
        const { row, col, itemsInThisRow, totalRows } = getGridLayout(index, citations.length, 4);
        
        const rowWidth = itemsInThisRow * citationWidth;
        const startX = CITATION_CENTER_X - (rowWidth / 2);
        const baseLeft = startX + (col * citationWidth);
        
        const yOffset = (totalRows - 1 - row) * citationHeight;
        const baseTop = CITATION_LINE_Y - citationHeight - yOffset;
        
        img.style.left = `${baseLeft + ribbonsOffsetX}px`; 
        img.style.top = `${baseTop + ribbonsOffsetY}px`; 
        img.style.width = `${citationWidth}px`; 
        img.style.height = `${citationHeight}px`; 
        img.style.zIndex = 500 - index;
        
        if (isRibbonsLocked) makeCategoryDraggable(img, 'ribbons'); else img.ondblclick = () => removeFromRack(citation.id);
        citationsContainer.appendChild(img);
    });

    // --- RENDER MEDALS (Building DOWN) ---
    const medalSpacing = 6; 
    medals.forEach((medal, index) => {
        const img = document.createElement('img');
        img.src = medal.activeImage;
        img.className = 'rack-item medal-item';
        
        const { row, col, itemsInThisRow } = getGridLayout(index, medals.length, 6);
        
        // For natural image sizes, we assume a ~16px width for centering offsets
        const assumedImgWidth = 16; 
        const rowWidth = (itemsInThisRow - 1) * medalSpacing; 
        const startX = MEDAL_CENTER_X - (rowWidth / 2) - (assumedImgWidth / 2);
        const baseLeft = startX + (col * medalSpacing);
        
        // Stack Downwards (row 0 touches line)
        const baseTop = MEDAL_LINE_Y + (row * medalSpacing); 
        
        img.style.left = `${baseLeft + medalsOffsetX}px`;
        img.style.top = `${baseTop + medalsOffsetY}px`;
        img.style.zIndex = 1000 - index; 
        
        if (isMedalsLocked) makeCategoryDraggable(img, 'medals'); else img.ondblclick = () => removeFromRack(medal.id);
        medalsContainer.appendChild(img);
    });

    // --- RENDER BADGES ---
    badges.forEach(badge => {
        const img = document.createElement('img');
        img.src = badge.activeImage;
        img.className = 'badge-item';
        img.style.left = (badge.x !== null ? badge.x : 56) + 'px'; 
        img.style.top = (badge.y !== null ? badge.y : 10) + 'px';
        img.style.zIndex = 2000;
        
        makeIndividualDraggable(img, badge);
        badgesContainer.appendChild(img);
    });
}

// --- DRAG ENGINES ---
function makeCategoryDraggable(el, category) {
    let startX, startY;
    el.onmousedown = function(e) {
        e.preventDefault();
        startX = e.clientX; startY = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    };
    function elementDrag(e) {
        e.preventDefault();
        let dx = (e.clientX - startX) / 4; 
        let dy = (e.clientY - startY) / 4;
        startX = e.clientX; startY = e.clientY;
        
        if (category === 'medals') {
            medalsOffsetX += dx; medalsOffsetY += dy;
            document.querySelectorAll('.medal-item:not(.indiv-unlocked)').forEach(img => {
                img.style.left = (parseFloat(img.style.left) + dx) + 'px';
                img.style.top = (parseFloat(img.style.top) + dy) + 'px';
            });
        } else if (category === 'ribbons') {
            ribbonsOffsetX += dx; ribbonsOffsetY += dy;
            document.querySelectorAll('.ribbon-item:not(.indiv-unlocked)').forEach(img => {
                img.style.left = (parseFloat(img.style.left) + dx) + 'px';
                img.style.top = (parseFloat(img.style.top) + dy) + 'px';
            });
        }
    }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

function makeIndividualDraggable(el, awardObj) {
    let startX, startY;
    el.onmousedown = function(e) {
        e.preventDefault(); e.stopPropagation();
        startX = e.clientX; startY = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    };
    function elementDrag(e) {
        e.preventDefault();
        let dx = (e.clientX - startX) / 4; 
        let dy = (e.clientY - startY) / 4;
        startX = e.clientX; startY = e.clientY;
        
        awardObj.x = (awardObj.x !== null ? awardObj.x : parseFloat(el.style.left)) + dx;
        awardObj.y = (awardObj.y !== null ? awardObj.y : parseFloat(el.style.top)) + dy;
        el.style.left = awardObj.x + 'px';
        el.style.top = awardObj.y + 'px';
    }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

// --- 128x128 EXPORTER ---
async function generateDecal() {
    if (selectedRack.length === 0) return alert("Please add awards to the preview first.");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128; canvas.height = 128;
    ctx.imageSmoothingEnabled = false;

    try {
        const domItems = Array.from(document.querySelectorAll('#preview-canvas img'));
        domItems.sort((a, b) => parseInt(a.style.zIndex || 0) - parseInt(b.style.zIndex || 0));
        
        for (let imgEl of domItems) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            await new Promise(resolve => { img.onload = resolve; img.src = imgEl.src; });
            
            const left = parseFloat(imgEl.style.left || 0);
            const top = parseFloat(imgEl.style.top || 0);
            const width = imgEl.style.width ? parseFloat(imgEl.style.width) : img.naturalWidth;
            const height = imgEl.style.height ? parseFloat(imgEl.style.height) : img.naturalHeight;
            
            ctx.drawImage(img, left, top, width, height);
        }

        const link = document.createElement('a');
        link.href = canvas.toDataURL("image/png");
        link.download = "Custom_Roblox_Uniform_Decal.png";
        link.click();
    } catch (error) {
        alert("Failed to compile the image.");
    }
}
