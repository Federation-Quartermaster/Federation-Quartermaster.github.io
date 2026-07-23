// --- GLOBALS ---
let allAwardsData = [];
let selectedRack = [];
let lastSubmissionData = ""; 

// Drag & Lock States (Updated for separate racks)
let isMedalRackLocked = false;
let isRibbonRackLocked = false;
let isCitationRackLocked = false;

let medalsOffsetX = 0, medalsOffsetY = 0;
let ribbonsOffsetX = 0, ribbonsOffsetY = 0;
let citationsOffsetX = 0, citationsOffsetY = 0;

// Dynamic Bottom Bar Tracking
let navPath = []; 

// ISKRA Badge Generator State
let uploadedHeadshotObj = null;

// --- MODAL HELPERS ---
function closeSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
}

function openBadgeModal() {
    document.getElementById('badge-modal').style.display = 'flex';
    updateBadgePreview();
}

function closeBadgeModal() {
    document.getElementById('badge-modal').style.display = 'none';
}

function copyAssetIdToClipboard() {
    if (lastSubmissionData) {
        navigator.clipboard.writeText(lastSubmissionData).then(() => {
            console.log("Submission data copied to clipboard:", lastSubmissionData);
        }).catch(err => {
            console.error("Failed to copy: ", err);
        });
    }
}

// Camera Zoom/Pan Engine
let scale = 4;

const CLIENT_ID = "7051205101808612404";
const REDIRECT_URI = "https://federation-quartermaster.github.io/redirect/"; 

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
            initExplorerScrolling(); 
        })
        .catch(err => console.error("Failed to load awards:", err));
});

function unifyAwardsData(data) {
    let unified = {};
    
    const processTable = (tableArray, typeName, imageKey) => {
        if (!tableArray) return;
        tableArray.forEach(item => {
            let f = item.folder || "";
            let sf = item.subFolder || "";
            let tierName = item.tier || "Standard";

            const tierKeywords = ["Bronze", "Silver", "Gold", "Platinum"];
            if (tierKeywords.includes(sf)) { tierName = sf; sf = ""; }
            if (tierKeywords.includes(f)) { tierName = f; f = ""; }

            if (f === item.name) f = "";
            if (sf === item.name) sf = "";

            const baseId = `${item.branch}_${f}_${sf}_${item.name}`;
            
            if (!unified[baseId]) {
                unified[baseId] = {
                    id: baseId,
                    branch: item.branch || "Unknown",
                    folder: f,          
                    subFolder: sf,      
                    name: item.name,
                    precedence: item.precedence,
                    tiers: {}, 
                    availableTypes: new Set() 
                };
            }
            
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

// --- EXPLORER SCROLL & DRAG SYSTEM ---
function initExplorerScrolling() {
    const container = document.getElementById('bottom-explorer');
    
    container.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        container.scrollLeft += evt.deltaY;
    });

    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;

    container.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'select') return;
        
        isDown = true;
        isDragging = false;
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    
    container.addEventListener('mouseleave', () => { isDown = false; });
    
    container.addEventListener('mouseup', (e) => { isDown = false; });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        isDragging = true;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; 
        container.scrollLeft = scrollLeft - walk;
    });

    container.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}


// --- DYNAMIC BOTTOM BAR NAVIGATION ---
function buildExplorer() {
    renderBottomBar();
    setupCanvasDropZone();
}

function renderBottomBar() {
    const container = document.getElementById('bottom-explorer');
    container.innerHTML = ''; 

    if (navPath.length > 0) {
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerHTML = '&#9664;';
        backBtn.onclick = () => { 
            navPath.pop(); 
            renderBottomBar(); 
        };
        container.appendChild(backBtn);
    }

    if (navPath.length === 0) {
        const rootCategories = ['Badges', 'Medals', 'Ribbons', 'Citations', 'Access Badges'];
        rootCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.textContent = category;
            
            if (category === 'Access Badges') {
                btn.style.borderColor = '#00a8ff';
                btn.onclick = () => { openBadgeModal(); };
            } else {
                btn.onclick = () => { 
                    navPath.push(category.slice(0, -1)); 
                    renderBottomBar(); 
                };
            }
            container.appendChild(btn);
        });
        updateSelectionPageOverlays();
        return;
    }

    const targetType = navPath[0];
    let currentItems = allAwardsData.filter(a => a.availableTypes.has(targetType));

    if (navPath[1]) currentItems = currentItems.filter(a => a.branch === navPath[1]);
    if (navPath[2]) currentItems = currentItems.filter(a => a.folder === navPath[2]);
    if (navPath[3]) currentItems = currentItems.filter(a => a.subFolder === navPath[3]);

    let nextProp = '';
    if (navPath.length === 1) nextProp = 'branch';
    else if (navPath.length === 2) nextProp = 'folder';
    else if (navPath.length === 3) nextProp = 'subFolder';

    if (nextProp) {
        const groups = new Set(currentItems.map(a => a[nextProp]).filter(Boolean));
        
        groups.forEach(groupName => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.textContent = groupName;
            btn.onclick = () => { 
                navPath.push(groupName); 
                renderBottomBar(); 
            };
            container.appendChild(btn);
        });

        const directItems = currentItems.filter(a => !a[nextProp]);
        renderAwardCards(directItems, targetType, container);
    } else {
        renderAwardCards(currentItems, targetType, container);
    }
}

// --- ISKRA ACCESS BADGE GENERATOR LOGIC (ROBLOX API) ---
async function fetchAndLoadUserHeadshot() {
    const rawInput = document.getElementById('roblox-username-input').value.trim();
    const usernameInput = rawInput.toLowerCase(); 
    const statusDiv = document.getElementById('headshot-status');
    
    if (!usernameInput) {
        statusDiv.style.color = '#d9534f';
        statusDiv.textContent = "Please enter a Roblox username first.";
        return;
    }

    statusDiv.style.color = '#ffcc00';
    statusDiv.textContent = "Resolving username to User ID...";

    try {
        const targetUserUrl = encodeURIComponent("https://users.roblox.com/v1/usernames/users");
        const userRes = await fetch(`https://corsproxy.io/?url=${targetUserUrl}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [usernameInput], excludeBannedUsers: true })
        });
        const userData = await userRes.json();

        if (!userData.data || userData.data.length === 0) {
            statusDiv.style.color = '#d9534f';
            statusDiv.textContent = "User not found (ensure exact spelling).";
            return;
        }

        const userId = userData.data[0].id;
        statusDiv.textContent = `Found User ID (${userId}). Fetching headshot...`;

        const targetThumbUrl = encodeURIComponent(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
        const thumbRes = await fetch(`https://corsproxy.io/?url=${targetThumbUrl}`);
        const thumbData = await thumbRes.json();

        if (!thumbData.data || thumbData.data.length === 0 || !thumbData.data[0].imageUrl) {
            statusDiv.style.color = '#d9534f';
            statusDiv.textContent = "Failed to fetch avatar headshot.";
            return;
        }

        const headshotUrl = thumbData.data[0].imageUrl;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            uploadedHeadshotObj = img;
            statusDiv.style.color = '#00ffcc';
            statusDiv.textContent = "Headshot successfully loaded!";
            updateBadgePreview();
        };
        img.onerror = function() {
            statusDiv.style.color = '#d9534f';
            statusDiv.textContent = "Failed to load headshot image texture.";
        };
        img.src = headshotUrl;

    } catch (err) {
        console.error(err);
        statusDiv.style.color = '#d9534f';
        statusDiv.textContent = "Network error connecting to Roblox APIs.";
    }
}

function updateBadgePreview() {
    const templateSrc = document.getElementById('badge-template-select').value;
    const overlaySrc = document.getElementById('badge-overlay-select').value;
    
    const canvas = document.getElementById('badge-preview-canvas');
    canvas.width = 25;
    canvas.height = 39;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const templateImg = new Image();
    templateImg.onload = function() {
        ctx.drawImage(templateImg, 0, 0, 25, 39);
        
        if (overlaySrc) {
            const overlayImg = new Image();
            overlayImg.onload = function() {
                ctx.drawImage(overlayImg, 0, 0, 25, 39);
                
                if (uploadedHeadshotObj) {
                    ctx.drawImage(uploadedHeadshotObj, 2, 7, 15, 15);
                }
            };
            overlayImg.src = overlaySrc;
        } else {
            if (uploadedHeadshotObj) {
                ctx.drawImage(uploadedHeadshotObj, 2, 7, 15, 15);
            }
        }
    };
    templateImg.src = templateSrc;
}

function generateAndAddBadgeToRack() {
    const templateSrc = document.getElementById('badge-template-select').value;
    const overlaySrc = document.getElementById('badge-overlay-select').value;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 25;
    tempCanvas.height = 39;
    const ctx = tempCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const templateImg = new Image();
    templateImg.crossOrigin = "Anonymous";
    templateImg.onload = function() {
        ctx.drawImage(templateImg, 0, 0, 25, 39);
        
        if (overlaySrc) {
            const overlayImg = new Image();
            overlayImg.crossOrigin = "Anonymous";
            overlayImg.onload = function() {
                ctx.drawImage(overlayImg, 0, 0, 25, 39);
                
                if (uploadedHeadshotObj) {
                    ctx.drawImage(uploadedHeadshotObj, 2, 7, 15, 15);
                }
                finalizeAndPushBadge(tempCanvas);
            };
            overlayImg.src = overlaySrc;
        } else {
            if (uploadedHeadshotObj) {
                ctx.drawImage(uploadedHeadshotObj, 2, 7, 15, 15);
            }
            finalizeAndPushBadge(tempCanvas);
        }
    };
    templateImg.src = templateSrc;
}

function finalizeAndPushBadge(tempCanvas) {
    const finalDataUrl = tempCanvas.toDataURL("image/png");
    const customBadgeId = `iskra_custom_badge_${Date.now()}`;

    selectedRack.push({
        id: customBadgeId,
        name: "ISKRA Access Badge",
        type: 'Badge',
        isCitation: false,
        activeImage: finalDataUrl,
        precedence: 999,
        folder: "ISKRA Access Badges",
        subFolder: "",
        x: 56, 
        y: 40
    });

    renderPreview();
    closeBadgeModal();
}

// --- RENDERING AWARD PREVIEWS ---
function renderAwardCards(awards, activeType, container) {
    awards.sort((a, b) => a.precedence - b.precedence).forEach(award => {
        const card = document.createElement('div');
        card.className = 'award-card';
        card.draggable = true;
        card.setAttribute('data-award-id', award.id);
        
        const tierKeys = Object.keys(award.tiers);
        let selectedTier = tierKeys[0];

        const img = document.createElement('img');
        img.src = award.tiers[selectedTier][activeType];
        
        const nameLabel = document.createElement('span');
        nameLabel.textContent = award.name.replace(/^\d+\.\s*/, ''); 

        card.appendChild(img);
        card.appendChild(nameLabel);

        if (tierKeys.length > 1 || tierKeys[0] !== "Standard") {
            const tierSelect = document.createElement('select');
            tierSelect.className = 'award-variant-select';
            tierKeys.forEach(tier => {
                const option = document.createElement('option');
                option.value = tier;
                option.textContent = tier;
                tierSelect.appendChild(option);
            });
            
            tierSelect.onmousedown = (e) => e.stopPropagation(); 
            tierSelect.onchange = (e) => {
                selectedTier = e.target.value;
                img.src = award.tiers[selectedTier][activeType]; 
            };
            card.appendChild(tierSelect);
        }

        card.onclick = () => {
            const existingIndex = selectedRack.findIndex(item => item.id === award.id);
            if (existingIndex !== -1) {
                removeFromRack(award.id);
            } else {
                addAwardToRack(award, activeType, selectedTier);
            }
        };
        
        card.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                id: award.id,
                type: activeType,
                tier: selectedTier
            }));
        };

        container.appendChild(card);
    });

    updateSelectionPageOverlays();
}

function addAwardToRack(award, activeType, selectedTier, dropX = null, dropY = null) {
    selectedRack = selectedRack.filter(a => a.id !== award.id);
    
    selectedRack.push({
        id: award.id,
        name: award.name,
        type: activeType,
        isCitation: activeType === 'Citation',
        activeImage: award.tiers[selectedTier][activeType],
        precedence: award.precedence,
        folder: award.folder,
        subFolder: award.subFolder,
        x: dropX, 
        y: dropY
    });
    
    renderPreview();
}

function setupCanvasDropZone() {
    const canvasArea = document.getElementById('canvas-pan-area');
    
    canvasArea.ondragover = (e) => e.preventDefault(); 
    
    canvasArea.ondrop = (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        const payload = JSON.parse(data);
        const award = allAwardsData.find(a => a.id === payload.id);
        
        if (award) {
            const torsoRect = document.getElementById('preview-canvas').getBoundingClientRect();
            let dropX = (e.clientX - torsoRect.left) / scale; 
            let dropY = (e.clientY - torsoRect.top) / scale;

            addAwardToRack(award, payload.type, payload.tier, dropX, dropY);
        }
    };
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

// Top Bar Lock Toggles
function toggleMedalRackLock() {
    isMedalRackLocked = !isMedalRackLocked;
    const btn = document.getElementById('btn-lock-medals');
    if (btn) {
        btn.textContent = isMedalRackLocked ? "Unlock Medal Rack" : "Lock Medal Rack";
        btn.classList.toggle('tool-locked', isMedalRackLocked);
    }
    renderPreview();
}

function toggleRibbonRackLock() {
    isRibbonRackLocked = !isRibbonRackLocked;
    const btn = document.getElementById('btn-lock-ribbons');
    if (btn) {
        btn.textContent = isRibbonRackLocked ? "Unlock Ribbon Rack" : "Lock Ribbon Rack";
        btn.classList.toggle('tool-locked', isRibbonRackLocked);
    }
    renderPreview();
}

function toggleCitationRackLock() {
    isCitationRackLocked = !isCitationRackLocked;
    const btn = document.getElementById('btn-lock-citations');
    if (btn) {
        btn.textContent = isCitationRackLocked ? "Unlock Citation Rack" : "Lock Citation Rack";
        btn.classList.toggle('tool-locked', isCitationRackLocked);
    }
    renderPreview();
}

function clearAllAwardRacks() {
    if (confirm("Are you sure you want to clear all awards from the page?")) {
        selectedRack = [];
        renderPreview();
    }
}

function removeFromRack(id) {
    selectedRack = selectedRack.filter(a => a.id !== id);
    renderPreview();
}

// --- SELECTION PAGE OVERLAY (CLICK TO REMOVE) ---
function updateSelectionPageOverlays() {
    const awardCards = document.querySelectorAll('.award-card');
    awardCards.forEach(card => {
        const awardId = card.getAttribute('data-award-id');
        const isOnPage = selectedRack.some(item => item.id === awardId);

        let overlay = card.querySelector('.remove-overlay');
        if (overlay) overlay.remove();

        if (isOnPage) {
            card.style.position = 'relative';
            overlay = document.createElement('div');
            overlay.className = 'remove-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.color = '#000000';
            overlay.style.fontWeight = 'bold';
            overlay.style.fontSize = '10px';
            overlay.style.textAlign = 'center';
            overlay.style.pointerEvents = 'none';
            overlay.textContent = 'Click To Remove';
            card.appendChild(overlay);
        }
    });
}

// --- SMART PADDING DETECTOR ---
function applySmartPadding(imgElement, baseTop) {
    imgElement.crossOrigin = "Anonymous"; 

    const checkPixels = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = imgElement.naturalWidth || 16;
        canvas.height = 1; 
        
        ctx.drawImage(imgElement, 0, 0);
        
        const pixels = ctx.getImageData(0, 0, canvas.width, 1).data;
        let isTopRowTransparent = true;
        
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) { 
                isTopRowTransparent = false;
                break;
            }
        }
        
        if (!isTopRowTransparent) {
            imgElement.style.top = `${baseTop + 1}px`;
        }
    };

    if (imgElement.complete) {
        checkPixels();
    } else {
        imgElement.addEventListener('load', checkPixels);
    }
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

function getMedalRowCounts(total) {
    if (total === 0) return [];
    const maxPerRow = 6;
    const numRows = Math.ceil(total / maxPerRow);
    const baseCount = Math.floor(total / numRows);
    const remainder = total % numRows;
    
    let rowCounts = [];
    for (let i = 0; i < numRows; i++) {
        if (i >= numRows - remainder) {
            rowCounts.push(baseCount + 1);
        } else {
            rowCounts.push(baseCount);
        }
    }
    return rowCounts;
}

function getMedalLayout(index, total) {
    const rowCounts = getMedalRowCounts(total);
    let currentIndex = 0;
    let row = 0;
    
    for (let i = 0; i < rowCounts.length; i++) {
        if (index < currentIndex + rowCounts[i]) {
            row = i;
            break;
        }
        currentIndex += rowCounts[i];
    }
    
    const col = index - currentIndex;
    const itemsInThisRow = rowCounts[row];
    const totalRows = rowCounts.length;
    
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

    [standardRibbons, medals].forEach(arr => arr.sort((a, b) => {
        const aDepth = (a.folder ? 1 : 0) + (a.subFolder ? 1 : 0);
        const bDepth = (b.folder ? 1 : 0) + (b.subFolder ? 1 : 0);
        
        if (aDepth !== bDepth) return aDepth - bDepth;
        if (a.folder !== b.folder) return (a.folder || "").localeCompare(b.folder || "");
        if (a.subFolder !== b.subFolder) return (a.subFolder || "").localeCompare(b.subFolder || "");
        return a.precedence - b.precedence;
    }));

    let groupFirstAddedIndex = {};
    selectedRack.forEach((item, globalIdx) => {
        if (item.type === 'Citation' && item.folder && !(item.folder in groupFirstAddedIndex)) {
            groupFirstAddedIndex[item.folder] = globalIdx;
        }
    });

    citations.sort((a, b) => {
        const groupA = a.folder || "";
        const groupB = b.folder || "";

        if (groupA !== groupB) {
            const orderA = groupFirstAddedIndex[groupA] !== undefined ? groupFirstAddedIndex[groupA] : 999;
            const orderB = groupFirstAddedIndex[groupB] !== undefined ? groupFirstAddedIndex[groupB] : 999;
            return orderA - orderB;
        }

        return a.precedence - b.precedence;
    });

    const hasRibbons = standardRibbons.length > 0;
    const hasMedals = medals.length > 0;

    const LEFT_POCKET_CENTER_X = 26;  
    const RIGHT_POCKET_CENTER_X = 102; 

    const RED_LINE_Y = 33;    
    const GREEN_LINE_Y = 35;  
    const BLUE_LINE_Y = 35;   

    const RIBBON_LINE_Y = BLUE_LINE_Y;
    const RIBBON_CENTER_X = RIGHT_POCKET_CENTER_X;

    const MEDAL_LINE_Y = hasRibbons ? GREEN_LINE_Y : BLUE_LINE_Y;
    const MEDAL_CENTER_X = hasRibbons ? LEFT_POCKET_CENTER_X : RIGHT_POCKET_CENTER_X;
    
    const CITATION_LINE_Y = (hasRibbons && hasMedals) ? RED_LINE_Y : GREEN_LINE_Y;
    const CITATION_CENTER_X = LEFT_POCKET_CENTER_X;

   // --- RENDER STANDARD RIBBONS ---
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
        
        const baseTop = RIBBON_LINE_Y - ribbonHeight - yOffset + 1; 
        
        img.style.left = `${baseLeft + ribbonsOffsetX}px`; 
        img.style.top = `${baseTop + ribbonsOffsetY}px`; 
        img.style.width = `${ribbonWidth}px`; 
        img.style.height = `${ribbonHeight}px`; 
        img.style.zIndex = 500 - index;
        
        if (!isRibbonRackLocked) {
            makeCategoryDraggable(img, 'ribbons');
        } else {
            makeIndividualDraggable(img, ribbon);
        }
        img.ondblclick = () => removeFromRack(ribbon.id);
        ribbonsContainer.appendChild(img);
    });

   // --- RENDER CITATIONS ---
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
        const baseTop = CITATION_LINE_Y - citationHeight - yOffset + 1;
        
        img.style.left = `${baseLeft + ribbonsOffsetX}px`; 
        img.style.top = `${baseTop + ribbonsOffsetY}px`; 
        img.style.width = `${citationWidth}px`; 
        img.style.height = `${citationHeight}px`; 
        img.style.zIndex = 500 - index;
        
        if (!isCitationRackLocked) {
            makeCategoryDraggable(img, 'ribbons');
        } else {
            makeIndividualDraggable(img, citation);
        }
        img.ondblclick = () => removeFromRack(citation.id);
        citationsContainer.appendChild(img);
    });

    // --- RENDER MEDALS ---
    const medalSpacing = 6; 
    const ribbonWidthOnly = 16; 

    medals.forEach((medal, index) => {
        const img = document.createElement('img');
        img.src = medal.activeImage;
        img.className = 'rack-item medal-item';
        
        const { row, col, itemsInThisRow, totalRows } = getMedalLayout(index, medals.length);
        const rowWidth = ((itemsInThisRow - 1) * medalSpacing) + ribbonWidthOnly; 
        
        let centerX = MEDAL_CENTER_X;
        
        let startX = centerX - (rowWidth / 2);
        let slotCenterX = startX + (col * medalSpacing) + (ribbonWidthOnly / 2) + medalsOffsetX;
        
        img.style.left = `${slotCenterX}px`;
        img.style.transform = `translateX(-50%)`;
        
        const yOffset = (totalRows - 1 - row) * medalSpacing;
        const baseTop = MEDAL_LINE_Y - yOffset + medalsOffsetY;
        img.style.top = `${baseTop}px`;
        
        applySmartPadding(img, baseTop);
        img.style.zIndex = 1000 - index; 
        
        if (!isMedalRackLocked) {
            makeCategoryDraggable(img, 'medals');
        } else {
            makeIndividualDraggable(img, medal);
        }
        img.ondblclick = () => removeFromRack(medal.id);
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
        img.ondblclick = () => removeFromRack(badge.id); // Badges now removable via double click
        badgesContainer.appendChild(img);
    });

    updateSelectionPageOverlays();
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

// ==========================================
// ROBLOX OAUTH & EXPORT ENGINE
// ==========================================
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) result += charset[randomValues[i] % charset.length];
    return result;
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function initiateRobloxLogin() {
    const verifier = generateRandomString(64);
    const state = generateRandomString(32); 

    sessionStorage.setItem("code_verifier", verifier);
    sessionStorage.setItem("oauth_state", state); 

    const challenge = await generateCodeChallenge(verifier);
    
    window.location.href = `https://apis.roblox.com/oauth/v1/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid+profile+asset:write&response_type=code&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
}

async function getValidAccessToken() {
    const tokenData = JSON.parse(localStorage.getItem("roblox_auth"));
    if (!tokenData) return null;

    if (Date.now() >= tokenData.expires_at) {
        const body = new URLSearchParams({ 
            client_id: CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: tokenData.refresh_token
        });
        
        try {
            const response = await fetch("https://apis.roblox.com/oauth/v1/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body
            });
            const data = await response.json();
            if (data.access_token) {
                tokenData.access_token = data.access_token;
                tokenData.refresh_token = data.refresh_token;
                tokenData.expires_at = Date.now() + (data.expires_in * 1000);
                localStorage.setItem("roblox_auth", JSON.stringify(tokenData));
            } else {
                localStorage.removeItem("roblox_auth");
                return null;
            }
        } catch (err) {
            return null;
        }
    }
    return tokenData.access_token;
}

async function initializeAuth() {
    const btn = document.getElementById("roblox-login-btn");
    const activeToken = await getValidAccessToken();
    
    if (activeToken) {
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        const globalControls = document.querySelector('.global-controls');
        if (globalControls && !document.getElementById('disconnect-btn')) {
            const disconnectBtn = document.createElement('button');
            disconnectBtn.id = 'disconnect-btn';
            disconnectBtn.className = 'tool-btn';
            disconnectBtn.style.backgroundColor = '#d9534f'; 
            disconnectBtn.style.borderColor = '#d43f3a';
            disconnectBtn.textContent = 'Disconnect Roblox';
            disconnectBtn.onclick = () => {
                if(confirm("Disconnect from Roblox?")) {
                    localStorage.removeItem("roblox_auth");
                    window.location.reload();
                }
            };
            globalControls.prepend(disconnectBtn); 
        }
    } else {
        if (btn) {
            btn.textContent = "Connect to Roblox";
            btn.onclick = initiateRobloxLogin;
        }
    }
}

document.addEventListener("DOMContentLoaded", initializeAuth);

function openExportModal() {
    if (selectedRack.length === 0) return alert("Please add awards to the preview first.");
    document.getElementById('export-modal').style.display = 'flex';
}

function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

async function buildCanvas() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128; canvas.height = 128;
    ctx.imageSmoothingEnabled = false;

    try {
        const domItems = Array.from(document.querySelectorAll('#preview-canvas img'))
            .filter(imgEl => imgEl.id !== 'torso-img');
            
        domItems.sort((a, b) => parseInt(a.style.zIndex || 0) - parseInt(b.style.zIndex || 0));
        
        for (let imgEl of domItems) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            await new Promise(resolve => { 
                img.onload = resolve; 
                img.onerror = resolve; 
                img.src = imgEl.src; 
            });
            
            let left = parseFloat(imgEl.style.left || 0);
            const top = parseFloat(imgEl.style.top || 0);
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (imgEl.style.width && imgEl.style.width.includes('px')) width = parseFloat(imgEl.style.width);
            if (imgEl.style.height && imgEl.style.height.includes('px')) height = parseFloat(imgEl.style.height);
            if (imgEl.style.transform === 'translateX(-50%)') left = left - (width / 2);
            
            ctx.drawImage(img, left, top, width, height);
        }
        return canvas;
    } catch (error) {
        console.error(error);
        alert("Failed to compile the image.");
        return null;
    }
}

async function executeDownload() {
    closeExportModal();
    const canvas = await buildCanvas();
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL("image/png");
    link.download = "Custom_Roblox_Uniform_Decal.png";
    link.click();
}

async function executeRobloxUpload() {
    const activeToken = await getValidAccessToken();
    
    if (!activeToken) {
        alert("You must log in with Roblox first to use this feature!");
        return;
    }

    closeExportModal();
    
    const exportBtn = document.querySelector('.export-btn'); 
    exportBtn.textContent = "Uploading to Roblox...";
    exportBtn.disabled = true;

    const canvas = await buildCanvas();
    if (!canvas) {
        exportBtn.textContent = "Export Decal";
        exportBtn.disabled = false;
        return;
    }

    canvas.toBlob(async (blob) => {
        try {
            const userInfoRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
                headers: { "Authorization": `Bearer ${activeToken}` }
            });
            const userInfo = await userInfoRes.json();

            const formData = new FormData();
            formData.append("request", JSON.stringify({
                assetType: "Decal",
                creationContext: { creator: { userId: userInfo.sub } },
                displayName: "Medals",
                description: "Generated Via Federation Quartermaster Rack Builder"
            }));
            formData.append("fileContent", blob, "uniform.png");

            const uploadRes = await fetch("https://apis.roblox.com/assets/v1/assets", {
                method: "POST",
                headers: { "Authorization": `Bearer ${activeToken}` },
                body: formData
            });
            
            const uploadData = await uploadRes.json();
            
            if (uploadRes.ok && uploadData.path) {
                exportBtn.textContent = "Processing Asset...";
                const operationPath = uploadData.path; 
                let finalAssetId = null;

                for (let i = 0; i < 10; i++) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const opRes = await fetch(`https://apis.roblox.com/assets/v1/${operationPath}`, {
                        headers: { "Authorization": `Bearer ${activeToken}` }
                    });
                    
                    const opData = await opRes.json();
                    
                    if (opData.done) {
                        finalAssetId = opData.response?.assetId;
                        break;
                    }
                }

                if (finalAssetId) {
                    console.log("Successfully created Asset ID:", finalAssetId);
                    
                    lastSubmissionData = `${userInfo.sub}, ${finalAssetId}`;
                    
                    document.getElementById('final-asset-id').textContent = finalAssetId;
                    document.getElementById('dashboard-link').href = `https://create.roblox.com/dashboard/creations/store/${finalAssetId}/configure`;
                    document.getElementById('success-modal').style.display = 'flex';
                    
                } else {
                    alert("Upload initiated, but timed out waiting for the final ID. Check your Roblox inventory in a few minutes.");
                }
                
            } else {
                console.error("Upload Error Data:", uploadData);
                alert("Roblox API rejected the upload. See console for details.");
            }
            
        } catch (uploadError) {
            console.error("Upload failed:", uploadError);
            alert("Failed to reach Roblox servers. Check the console for details.");
        } finally {
            exportBtn.textContent = "Export Decal";
            exportBtn.disabled = false;
        }
    }, "image/png");
}
