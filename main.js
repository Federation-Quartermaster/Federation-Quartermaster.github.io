let allAwards = [];

// Fetch the data and render it
fetch('awards.json')
    .then(response => response.json())
    .then(data => {
        allAwards = data;
        renderGallery(allAwards);
    });

function renderGallery(awards) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = ''; // Clear existing
    
    awards.forEach(award => {
        const card = document.createElement('div');
        card.className = 'award-card';
        card.innerHTML = `
            <img src="${award.image}" alt="${award.name}">
            <h3>${award.name}</h3>
            <p>Click to download PNG</p>
        `;
        
        // Force file download on click
        card.onclick = () => {
            const link = document.createElement('a');
            link.href = award.image;
            // Replaces spaces with underscores for a clean file name
            link.download = `${award.name.replace(/\s+/g, '_')}.png`; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        
        grid.appendChild(card);
    });
}

// Filter logic for the buttons
function filterAwards(category) {
    if (category === 'all') {
        renderGallery(allAwards);
    } else {
        const filtered = allAwards.filter(a => a.category === category);
        renderGallery(filtered);
    }
}
