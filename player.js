document.addEventListener('DOMContentLoaded', () => {
    // ====================================================================
    // --- PLAYER LOGIC ---
    // ====================================================================

    // --- Global State ---
    let specialsData;
    let currentContent;

    // --- Modal specific elements ---
    const downloadModal = document.getElementById('download-modal');
    const downloadModalTitle = document.getElementById('download-modal-title');
    const downloadOptionsList = document.getElementById('download-options-list');
    const episodeListElement = document.getElementById('episode-list');

    // --- Data Fetching ---
    async function fetchSpecialsData() {
        try {
            const specialsResult = await fetch('specials.json').catch(e => ({ ok: false, error: e }));
            const specialsJson = specialsResult.ok ? await specialsResult.json().catch(() => null) : null;
            if (!specialsJson) console.warn('Failed to fetch or parse specials.json');
            return { specialsData: specialsJson, error: null };
        } catch (error) {
            console.error("Critical error fetching specials data:", error);
            return { specialsData: null, error };
        }
    }

    async function fetchContentData(contentType, contentId) {
        const isSpecial = contentType === 'special';
        const fileName = isSpecial ? `specials.json` : `${contentType}-${contentId}.json`;

        try {
            const response = await fetch(fileName);
            if (!response.ok) throw new Error(`Failed to fetch ${fileName}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching data for ${contentType} ${contentId}:`, error);
            return null;
        }
    }

    // --- Storage Helper ---
    const storage = {
        get: (key) => {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.warn(`Could not read '${key}' from localStorage.`, e);
                return null;
            }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn(`Could not write '${key}' to localStorage.`, e);
            }
        }
    };

    // --- Helper Functions ---
    function getContentKey() {
        return (currentContent.isSpecial ? 'special_' : 'season_') + currentContent.id;
    }

    function saveProgress(episodeIndex) {
        const progress = storage.get('btthProgress') || {};
        const key = getContentKey();
        if (!progress[key]) progress[key] = [];
        if (!progress[key].includes(episodeIndex)) {
            progress[key].push(episodeIndex);
            storage.set('btthProgress', progress);
        }
    }

    function saveLastPlayed(episodeIndex) {
        const lastPlayed = storage.get('btthLastPlayed') || {};
        lastPlayed[getContentKey()] = episodeIndex;
        storage.set('btthLastPlayed', lastPlayed);
    }

    function populateContentDetails() {
        try {
            document.title = `Download ${currentContent.data.title} | RJ Dubbers`;
            document.getElementById('player-title').textContent = currentContent.data.title;
            const ratingContainer = document.querySelector('.player-global-rating');
            if (ratingContainer && currentContent.data.globalRating) {
                ratingContainer.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 18.26l-7.053 3.948 1.575-7.928L.587 8.792l8.027-.952L12 .5l3.386 7.34 8.027.952-5.935 5.488 1.575 7.928z" fill="currentColor"/></svg>
                <span>${currentContent.data.globalRating.toFixed(1)}</span>
            `;
                ratingContainer.style.display = 'flex';
            } else if (ratingContainer) {
                ratingContainer.style.display = 'none';
            }
            const vaContainer = document.querySelector('.player-vas');
            if (vaContainer && currentContent.data.vas) {
                vaContainer.innerHTML = '';
                const vas = currentContent.data.vas.split(',');
                const vaList = document.createElement('ul');
                let hasVAs = false;
                vas.forEach(va => {
                    const [character, actor] = va.split(':').map(s => s.trim());
                    if (character && actor) {
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${character}:</strong> ${actor}`;
                        vaList.appendChild(li);
                        hasVAs = true;
                    }
                });
                if (hasVAs) {
                    const h3 = document.createElement('h3');
                    h3.textContent = 'Key Voice Actors';
                    vaContainer.append(h3, vaList);
                }
            }
        } catch (e) {
            console.error("Failed to populate content details:", e);
        }
    }

    function populateEpisodeList() {
        episodeListElement.innerHTML = '';
        if (currentContent.data.episodes && currentContent.data.episodes.length > 0) {
            const progress = (storage.get('btthProgress') || {})[getContentKey()] || [];

            currentContent.data.episodes.forEach((episode, index) => {
                const li = document.createElement('li');
                li.dataset.index = index;
                li.setAttribute('role', 'button');
                li.setAttribute('tabindex', '0');
                if (progress.includes(index)) li.classList.add('watched');

                const hasDownload = episode.downloadSources?.some(s => s.src && !s.src.startsWith('YOUR_'));
                const downloadButtonHTML = hasDownload ? `
                    <button class="watch-button episode-action-btn">Watch</button>` : '<span class="watch-button episode-action-btn disabled">Soon</span>';
                li.innerHTML = `
                    <div class="episode-info-wrapper">
                        <span class="episode-title">${episode.title}</span>
                    </div>
                    <div class="episode-rating" title="Episode Rating">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 18.26l-7.053 3.948 1.575-7.928L.587 8.792l8.027-.952L12 .5l3.386 7.34 8.027.952-5.935 5.488 1.575 7.928z" fill="currentColor"/></svg>
                        <span class="rating-value">${episode.rating ? episode.rating.toFixed(1) : 'N/A'}</span>
                    </div>  
                    <div class="episode-actions">
                        ${downloadButtonHTML}
                    </div>  
                `;
                episodeListElement.appendChild(li);
            });
        } else {
            episodeListElement.innerHTML = '<li>Episodes coming soon...</li>';
        }
    }

    function updateUI() {
        if (!currentContent?.data) {
            console.error('No content data provided for updateUI');
            return;
        }
        document.body.classList.remove('content-not-found');
        populateContentDetails();

        if (currentContent.data.episodes && currentContent.data.episodes.length > 0) {
            updateEpisodeDescription(0); // Set description for the first episode on load
        }

        populateEpisodeList();
    }

    // --- Modal Management ---
    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
    }

    function hideModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-close-modal]')) hideModals();
        if (e.target.matches('.modal-overlay')) hideModals();
    });

    function openDownloadModal(episodeIndex) {
        const episode = currentContent.data.episodes[episodeIndex];
        if (!episode || !episode.downloadSources || episode.downloadSources.length === 0) {
            console.warn('No download sources for this episode.');
            return;
        }

        downloadModalTitle.textContent = `Download: ${episode.title}`;
        downloadOptionsList.innerHTML = '';

        episode.downloadSources.forEach(source => {
            if (!source.src || source.src.startsWith('YOUR_')) return;

            const link = document.createElement('a');
            link.href = source.src;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = `
                <span class="quality-label">${source.quality || 'HD'}</span>
                <span class="size-label">${source.size || 'N/A'}</span>
            `;
            downloadOptionsList.appendChild(link);
        });
        showModal('download-modal');
    }

    function startDirectDownload(episodeIndex) {
        const episode = currentContent.data.episodes[episodeIndex];
        if (!episode?.downloadSources?.[0]?.src || episode.downloadSources[0].src.startsWith('YOUR_')) {
            alert(`The download for "${episode.title}" is not available yet.`);
            console.warn('No valid download source for this episode.');
            return;
        }
        const downloadUrl = episode.downloadSources[0].src;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function updateEpisodeDescription(episodeIndex) {
        const episode = currentContent.data.episodes[episodeIndex];
        if (episode) {
            document.getElementById('player-description').textContent = episode.description || 'No description available for this episode.';
            document.querySelectorAll('#episode-list li').forEach(el => el.classList.remove('playing'));
            document.querySelector(`#episode-list li[data-index="${episodeIndex}"]`)?.classList.add('playing');
        }
    }

    // --- Event Handlers ---
    function handleEpisodeInteraction(e) {
        const li = e.target.closest('li[data-index]');
        if (!li) return;

        const episodeIndex = parseInt(li.dataset.index, 10);
        if (isNaN(episodeIndex)) return;

        if (e.target.closest('.episode-action-btn')) {
            if (e.target.classList.contains('disabled')) return;
            startDirectDownload(episodeIndex);
        } else {
            updateEpisodeDescription(episodeIndex);
        }
    }

    function setupPlayerEventListeners() {
        episodeListElement.addEventListener('click', handleEpisodeInteraction);
        episodeListElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleEpisodeInteraction(e);
            }
        });
    }

    // --- Initialization ---
    async function initializePlayer(contentType, contentId) {
        const isSpecial = contentType === 'special';
        const loader = document.getElementById('player-loader');
        loader.classList.remove('hidden');

        let contentData;

        if (isSpecial) {
            if (!specialsData) {
                const data = await fetchSpecialsData();
                if (data.error || !data.specialsData) {
                    handleContentNotFound('Specials could not be loaded. Please try again later.');
                    return;
                }
                specialsData = data.specialsData;
            }
            contentData = specialsData.find(s => s.id == contentId);
        } else {
            contentData = await fetchContentData(contentType, contentId);
        }

        if (!contentData) {
            handleContentNotFound(`The requested content (ID: ${contentId}) was not found.`);
            return;
        }

        currentContent = { id: contentId, isSpecial: isSpecial, data: contentData };
        updateUI();
        if (loader) loader.style.display = 'none';
    }

    function handleContentNotFound(customMessage = "") {
        document.body.classList.add('content-not-found');
        const title = document.getElementById('player-title');
        const description = document.getElementById('player-description');
        document.getElementById('player-loader')?.classList.add('hidden');
        
        title.textContent = 'Content Not Found';
        description.innerHTML = `${customMessage}<br><br>Please go back and try a different selection.`;

        console.error(customMessage);
    }

    // --- Main Execution ---
    const urlParams = new URLSearchParams(window.location.search);
    const contentType = urlParams.get('type');
    const contentId = urlParams.get('id');

    if (contentType && contentId) {
        setupPlayerEventListeners();
        initializePlayer(contentType, contentId);
    } else {
        handleContentNotFound("No content specified.");
    }
});