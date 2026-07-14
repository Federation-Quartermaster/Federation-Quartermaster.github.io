// --- GLOBALS ---
let allAwardsData = [];
let selectedRack = [];

// Drag & Lock States
let isMedalsLocked = false;
let isRibbonsLocked = false;
let medalsOffsetX = 0, medalsOffsetY = 0;
let ribbonsOffsetX = 0, ribbonsOffsetY = 0;

// Camera Zoom/Pan Engine
let scale = 4;

// --- DATA FETCH & UNIFICATION ---
document.addEventListener("DOMContentLoaded", () => {
    fetch('awards.json')
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(data => {
            allAwardsData = unifyAwardsData(data);
            buildExplorer();
        })
        .catch(err => console.error("Failed to load awards:", err));
});

function unifyAwardsData(data) {
    let unified = {};
    
    const processTable = (tableArray, typeName, imageKey) => {
        if (!tableArray) return;
        tableArray.forEach(item => {
            const baseId = `${item.branch}_${item.folder}_${item.subFolder}_${item.name}`;
            
            if (!unified[baseId]) {
                unified[baseId] = {
                    id: baseId,
                    branch: item.branch || "Unknown",
                    folder: item.folder || "",
                    subFolder: item.subFolder || "",
                    name: item.name,
                    precedence: item.precedence,
                    tiers: {}, 
                    availableTypes: new Set() 
                };
            }
            
            const tierName = item.tier || "Standard";
            if (!unified[baseId].tiers[tierName]) unified[baseId].tiers[tierName] = {};
            
            if (item[imageKey]) {
                unified[baseId].tiers[tierName][typeName] = item[imageKey];
                unified[baseId].availableTypes.add(typeName);
            }
        });
    };

    processTable(data.Citations, 'Citation', 'citationImage');
    processTable(data.Ribbons, 'Ribbon', 'ribbonImage');
    processTable(data.Medals, 'Medal', 'medalImage');
    processTable(data.Badges, 'Badge', 'badgeImage');

    return Object.values(unified);
}

// --- EXPLORER UI BUILDER ---
function buildExplorer() {
    const container = document.getElementById('frames-container');
    container.innerHTML = ''; 
    
    const tree = {};
    allAwardsData.forEach(award => {
        if (!tree[award.branch]) tree[award.branch] = {};
        if (!tree[award.branch][award.folder]) tree[award.branch][award.folder] = {};
        if (!tree[award.branch][award.folder][award.subFolder]) tree[award.branch][award.folder][award.subFolder] = [];
        
        tree[award.branch][award.folder][award.subFolder].push(award);
    });

    function createNodes(levelObj, parentEl) {
        for (const key in levelObj) {
            if (Array.isArray(levelObj[key])) {
                levelObj[key].sort((a, b) => a.precedence - b.precedence).forEach(award => {
                    parentEl.appendChild(createAwardRow(award));
                });
            } else {
                if (key === "") {
                    createNodes(levelObj[key], parentEl);
                } else {
                    const details = document.createElement('details');
                    const summary = document.createElement('summary');
                    summary.textContent = key;
                    details.appendChild(summary);
                    
                    const innerContainer = document.createElement('div');
                    innerContainer.className = 'nested-folder'; 
                    createNodes(levelObj[key], innerContainer);
                    
                    details.appendChild(innerContainer);
                    parentEl.appendChild(details);
                }
            }
        }
    }
    
    createNodes(tree, container);
}

function createAwardRow(award) {
    const row = document.createElement('div');
    row.className = 'award-row';
    
    // Checkbox for adding/removing from rack
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'activate-btn';
    checkbox.id = `chk_${award.id}`;
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'award-name';
    nameLabel.textContent = award.name.replace(/^\d+\.\s*/, ''); 
    nameLabel.title = award.name;
    
    row.appendChild(checkbox);
    row.appendChild(nameLabel);

    // Initial States
    const tierKeys = Object.keys(award.tiers);
    let selectedTier = tierKeys[0]; 
    let activeType = Array.from(award.availableTypes)[0]; 

    // Sync state to the visual rack
    const updateRackIfActive = () => {
        if (checkbox.checked) {
            // Remove old instance
            selectedRack = selectedRack.filter(a => a.id !== award.id);
            // Add updated instance
            selectedRack.push({
                id: award.id,
                name: award.name,
                type: activeType,
                isCitation: activeType === 'Citation',
                activeImage: award.tiers[selectedTier][activeType],
                precedence: award.precedence,
                x: null, y: null
            });
            renderPreview();
        }
    };

    // Render Tiers Dropdown
    if (tierKeys.length > 1 || tierKeys[0] !== "Standard") {
        const tierSelect = document.createElement('select');
        tierSelect.className = 'tier-select';
        tierKeys.forEach(tier => {
            const option = document.createElement('option');
            option.value = tier;
            option.textContent = tier;
            tierSelect.appendChild(option);
        });
        tierSelect.onchange = (e) => { 
            selectedTier = e.target.value; 
            updateRackIfActive(); 
        };
        row.appendChild(tierSelect);
    }

    // Render Type Toggle (C, R, M, B)
    const typeToggle = document.createElement('div');
    typeToggle.className = 'type-toggle';
    const typeConfigs = [
        { label: 'C', value: 'Citation', title: 'Citation' },
        { label: 'R', value: 'Ribbon', title: 'Ribbon' },
        { label: 'M', value: 'Medal', title: 'Medal' },
        { label: 'B', value: 'Badge', title: 'Badge' }
    ];

    typeConfigs.forEach(tc => {
        const btn = document.createElement('button');
        btn.textContent = tc.label;
        btn.title = tc.title;
        
        if (!award.availableTypes.has(tc.value)) {
            btn.disabled = true;
        } else {
            if (tc.value === activeType) btn.classList.add('active');
            btn.onclick = () => {
                typeToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeType = tc.value;
                updateRackIfActive();
            };
        }
        typeToggle.appendChild(btn);
    });
    row.appendChild(typeToggle);

    // Checkbox Listener
    checkbox.onchange = (e) => {
        if (e.target.checked) {
            selectedRack.push({
                id: award.id,
                name: award.name,
                type: activeType,
                isCitation: activeType === 'Citation',
                activeImage: award.tiers[selectedTier][activeType],
                precedence: award.precedence,
                x: null, y: null
            });
        } else {
            selectedRack = selectedRack.filter(a => a.id !== award.id);
        }
        renderPreview();
    };
    
    return row;
}

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
        btn.innerHTML = isMedalsLocked ? '🔓 Medals Locked' : '🔓 Lock Medals';
    } else {
        isRibbonsLocked = !isRibbonsLocked;
        const btn = document.getElementById('lock-ribbons-btn');
        btn.classList.toggle('tool-locked', isRibbonsLocked);
        btn.innerHTML = isRibbonsLocked ? '🔓 Ribbons Locked' : '🔓 Lock Ribbons';
    }
    renderPreview();
}

function removeFromRack(id) {
    selectedRack = selectedRack.filter(a => a.id !== id);
    const checkbox = document.getElementById(`chk_${id}`);
    if (checkbox) checkbox.checked = false;
    renderPreview();
}

// --- DYNAMIC RENDERING ALGORITHM ---
function getGridLayout(index, totalItems, maxColumns) {
    const totalRows = Math.ceil(totalItems / maxColumns);
    const topRowCount = (totalItems % maxColumns === 0) ? maxColumns : (totalItems % maxColumns);
    let row, col, itemsInThisRow;

    if (index < topRowCount) {
        row = 0; 
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

    const standardRibbons = selectedRack.filter(a => a.type === 'Ribbon');
    const citations = selectedRack.filter(a => a.type === 'Citation');
    const medals = selectedRack.filter(a => a.type === 'Medal');
    const badges = selectedRack.filter(a => a.type === 'Badge');

    [standardRibbons, citations, medals].forEach(arr => arr.sort((a, b) => a.precedence - b.precedence));

    // MATRIX MATH
    const hasRibbons = standardRibbons.length > 0;
    const hasMedals = medals.length > 0;

    const LEFT_POCKET_CENTER_X = 28;  
    const RIGHT_POCKET_CENTER_X = 94; 

    const RED_LINE_Y = 32;
    const YELLOW_LINE_Y = 32;
    const GREEN_LINE_Y = 34;
    const BLUE_LINE_Y = 34;

    const RIBBON_LINE_Y = BLUE_LINE_Y;
    const RIBBON_CENTER_X = RIGHT_POCKET_CENTER_X;

    const MEDAL_LINE_Y = hasRibbons ? GREEN_LINE_Y : BLUE_LINE_Y;
    const MEDAL_CENTER_X = hasRibbons ? LEFT_POCKET_CENTER_X : RIGHT_POCKET_CENTER_X;
    const medalsOnGreen = (MEDAL_LINE_Y === GREEN_LINE_Y && hasMedals);

    const CITATION_LINE_Y = medalsOnGreen ? RED_LINE_Y : GREEN_LINE_Y;
    const CITATION_CENTER_X = LEFT_POCKET_CENTER_X;

    // RENDER STANDARD RIBBONS
    const ribbonWidth = 16;
    const ribbonHeight = 4;
    standardRibbons.forEach((ribbon, index) => {
        const img = document.createElement('img');
        img.src = ribbon.activeImage;
        img.className = 'rack-item ribbon-item';
        
        const { row, col, itemsInThisRow, totalRows } = getGridLayout(index, standardRibbons.length, 3);
        
        const rowWidth = itemsInThisRow * ribbonWidth;
        const startX = RIBBON_CENTER_X - (rowWidth / 2);
        const baseLeft = startX + (col * ribbonWidth);
        
        const yOffset = (totalRows - 1 - row) * ribbonHeight;
        const baseTop = RIBBON_LINE_Y - ribbonHeight - yOffset;
        
        img.style.left = `${baseLeft + ribbonsOffsetX}px`; 
        img.style.top = `${baseTop + ribbonsOffsetY}px`; 
        img.style.width = `${ribbonWidth}px`; 
        img.style.height = `${ribbonHeight}px`; 
        img.style.zIndex = 500 - index;
        
        if (isRibbonsLocked) makeCategoryDraggable(img, 'ribbons'); else img.ondblclick = () => removeFromRack(ribbon.id);
        ribbonsContainer.appendChild(img);
    });

    // RENDER CITATIONS
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

    // RENDER MEDALS
    const medalSpacing = 6; 
    medals.forEach((medal, index) => {
        const img = document.createElement('img');
        img.src = medal.activeImage;
        img.className = 'rack-item medal-item';
        
        const { row, col, itemsInThisRow } = getGridLayout(index, medals.length, 6);
        
        const assumedImgWidth = 16; 
        const rowWidth = (itemsInThisRow - 1) * medalSpacing; 
        const startX = MEDAL_CENTER_X - (rowWidth / 2) - (assumedImgWidth / 2);
        const baseLeft = startX + (col * medalSpacing);
        
        const baseTop = MEDAL_LINE_Y + (row * medalSpacing); 
        
        img.style.left = `${baseLeft + medalsOffsetX}px`;
        img.style.top = `${baseTop + medalsOffsetY}px`;
        img.style.zIndex = 1000 - index; 
        
        if (isMedalsLocked) makeCategoryDraggable(img, 'medals'); else img.ondblclick = () => removeFromRack(medal.id);
        medalsContainer.appendChild(img);
    });

    // RENDER BADGES
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
            await new Promise(resolve => { 
                img.onload = resolve; 
                img.onerror = resolve; // Prevents export crash if an image is missing
                img.src = imgEl.src; 
            });
            
            const left = parseFloat(imgEl.style.left || 0);
            const top = parseFloat(imgEl.style.top || 0);
            
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            // THE FIX: Force torso to 128x128, only parse 'px' values for the awards
            if (imgEl.id === 'torso-img') {
                width = 128;
                height = 128;
            } else {
                if (imgEl.style.width && imgEl.style.width.includes('px')) width = parseFloat(imgEl.style.width);
                if (imgEl.style.height && imgEl.style.height.includes('px')) height = parseFloat(imgEl.style.height);
            }
            
            ctx.drawImage(img, left, top, width, height);
        }

            const link = document.createElement('a');
            link.href = canvas.toDataURL("image/png");
            link.download = "Custom_Roblox_Uniform_Decal.png";
            link.click();
    } catch (error) {
        console.error(error);
        alert("Failed to compile the image.");
    }
}
