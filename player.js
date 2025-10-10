document.addEventListener('DOMContentLoaded', async () => {
    // --- Configuration ---
    // IMPORTANT: Replace 'your-public-bucket-name' with your actual Google Cloud Storage bucket name.
    const GCS_BUCKET_NAME = 'your-public-bucket-name';

    if (GCS_BUCKET_NAME === 'your-public-bucket-name') {
        console.error("CRITICAL: Please replace 'your-public-bucket-name' in player.js with your actual GCS bucket name.");
    }

    // --- Get elements from the DOM ---
    const videoElement = document.getElementById('player-video-element');
    const titleElement = document.getElementById('player-title');
    const descriptionElement = document.getElementById('player-description');
    const episodeListElement = document.getElementById('episode-list');
    const pageTitle = document.querySelector('title');

    const downloadModal = document.getElementById('download-modal');
    const downloadOptionsList = document.getElementById('download-options-list');

    // --- Data Fetching ---
    async function fetchData() {
        try {
            const [seasonsRes, specialsRes] = await Promise.all([
                fetch('seasons.json'),
                fetch('specials.json')
            ]);
            const seasonsData = await seasonsRes.json();
            const specialsData = await specialsRes.json();
            return { seasonsData, specialsData };
        } catch (error) {
            console.error("Failed to fetch content data:", error);
            return { seasonsData: null, specialsData: null };
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const seasonId = urlParams.get('season');
    const specialId = urlParams.get('special');
    const isSpecial = !!specialId;
    const contentId = isSpecial ? specialId : seasonId;
    const progressPrefix = isSpecial ? 'special_' : 'season_';

    // --- Functions ---
    function getProgress() {
        try {
            const progress = localStorage.getItem('btthProgress');
            return progress ? JSON.parse(progress) : {};
        } catch (e) {
            console.warn("Could not access localStorage. Progress will not be saved.", e);
            return {};
        }
    }

    function saveProgress(id, episodeIndex) {
        try {
            const progress = getProgress();
            const key = progressPrefix + id;
            if (!progress[key]) {
                progress[key] = [];
            }
            if (!progress[key].includes(episodeIndex)) {
                progress[key].push(episodeIndex);
            }
            localStorage.setItem('btthProgress', JSON.stringify(progress));
        } catch (e) {
            console.warn("Could not access localStorage. Progress could not be saved.", e);
        }
    }

    function removeProgress(id, episodeIndex) {
        try {
            const progress = getProgress();
            const key = progressPrefix + id;
            if (progress[key] && progress[key].includes(episodeIndex)) {
                progress[key] = progress[key].filter(index => index !== episodeIndex);
                if (progress[key].length === 0) {
                    delete progress[key];
                }
                localStorage.setItem('btthProgress', JSON.stringify(progress));
            }
        } catch (e) {
            console.warn("Could not access localStorage. Progress could not be updated.", e);
        }
    }

    function getLastPlayed() {
        try {
            const lastPlayed = localStorage.getItem('btthLastPlayed');
            return lastPlayed ? JSON.parse(lastPlayed) : {};
        } catch (e) {
            console.warn("Could not access localStorage. Last played episode will not be loaded.", e);
            return {};
        }
    }

    function saveLastPlayed(id, episodeIndex) {
        try {
            const lastPlayed = getLastPlayed();
            const key = progressPrefix + id;
            lastPlayed[key] = episodeIndex;
            localStorage.setItem('btthLastPlayed', JSON.stringify(lastPlayed));
        } catch (e) {
            console.warn("Could not access localStorage. Last played episode could not be saved.", e);
        }
    }

    function updateUI(id, seasonData) {
        // Populate static details
        pageTitle.textContent = `Watch ${seasonData.title} | RJ Dubbers`;
        descriptionElement.textContent = seasonData.description;

        // Populate VAs
        const vaContainer = document.querySelector('.player-vas');
        if (vaContainer && seasonData.vas) {
            const vas = seasonData.vas.split(',');
            const vaListHTML = vas.map(va => {
                const parts = va.split(':');
                if (parts.length < 2) return ''; // Skip malformed entries
                const character = parts[0].trim();
                const actor = parts[1].trim();
                return `<li><strong>${character}:</strong> ${actor}</li>`;
            }).join('');

            vaContainer.innerHTML = vaListHTML
                ? `<h3>Key Voice Actors</h3><ul id="player-va-list">${vaListHTML}</ul>`
                : '';
        }

        // Populate Episodes
        episodeListElement.innerHTML = '';
        if (seasonData.episodes && seasonData.episodes.length > 0) {
            const progressKey = progressPrefix + id;
            const progress = getProgress()[progressKey] || [];
            seasonData.episodes.forEach((episode, index) => {
                const li = document.createElement('li');
                li.dataset.index = index;

                const episodeActionsHTML = `
                    <button class="episode-download-btn" title="Download Episode">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M3 19h18v2H3v-2zm10-5.828L19.071 7.1l1.414 1.414L12 17 3.515 8.515 4.929 7.1 11 13.17V2h2v11.172z" fill="currentColor"/></svg>
                    </button>
                `;

                if (progress.includes(index)) {
                    li.classList.add('watched');
                }

                li.innerHTML = `
                    <div class="episode-info-wrapper">
                        <span class="watched-indicator" title="Mark as unwatched">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z" fill="currentColor"/></svg>
                        </span>
                        <span class="episode-title">${episode.title}</span>
                    </div>
                    <div class="episode-actions">
                        ${episodeActionsHTML}
                    </div>
                `;

                episodeListElement.appendChild(li);
            });
        } else {
            episodeListElement.innerHTML = '<li>Episodes coming soon...</li>';
        }
    }

    function playEpisode(element, id, index, shouldSave = true) {
        if (!element) {
            console.error("playEpisode was called without a valid element.");
            return;
        }
        const episodeData = (isSpecial ? specialsData : seasonsData)[id].episodes[index];
        if (!episodeData || !episodeData.src) {
            console.error("No video sources found for this episode.");
            return;
        }

        // Update video player source
        videoElement.src = episodeData.src;
        videoElement.load();
        const playPromise = videoElement.play();

        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Autoplay was prevented. This is normal browser behavior.
                // The user will have to click the play button on the controls.
                console.log("Autoplay was prevented:", error);
            });
        }

        // Update title under video
        titleElement.textContent = episodeData.title;

        // Save this as the last played episode, regardless of whether it was user-initiated
        saveLastPlayed(id, index);

        // Update styles
        document.querySelectorAll('#episode-list li').forEach(li => li.classList.remove('playing'));
        element.classList.add('playing');

        // Scroll the playing item into view
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Save progress
        if (shouldSave) {
            saveProgress(id, index);
            if (!element.classList.contains('watched')) {
                element.classList.add('watched');
            }
        }
    }

    videoElement.addEventListener('ended', () => {
        const currentPlaying = document.querySelector('#episode-list li.playing');
        if (currentPlaying) {
            const nextEpisodeElement = currentPlaying.nextElementSibling;
            // Check if the next element is a valid episode item
            if (nextEpisodeElement && nextEpisodeElement.dataset.index) {
                const nextIndex = parseInt(nextEpisodeElement.dataset.index, 10);
                if (!isNaN(nextIndex)) {
                    // The contentId is available in the outer scope, play the next episode
                    playEpisode(nextEpisodeElement, contentId, nextIndex);
                }
            }
        }
    });

    // --- Download Modal Logic ---
    function openDownloadModal(episodeIndex) {
        const episode = (isSpecial ? specialsData : seasonsData)[contentId].episodes[episodeIndex];
        if (!episode || !episode.downloadSources) return;

        downloadOptionsList.innerHTML = ''; // Clear previous options

        episode.downloadSources.forEach(source => {
            const link = document.createElement('a');
            link.href = source.src;
            link.download = true; // This attribute triggers the download
            link.innerHTML = ` 
                <span class="quality-label">${source.quality}</span>
                <span class="size-label">${source.size}</span>
            `;
            downloadOptionsList.appendChild(link);
        });

        showModal('download-modal');
    }

    // Centralized event listener for the episode list
    episodeListElement.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-index]');
        if (!li) return;

        const episodeIndex = parseInt(li.dataset.index, 10);
        if (isNaN(episodeIndex)) return;

        // Check if the watched indicator was clicked to toggle it off
        if (e.target.closest('.watched-indicator')) {
            removeProgress(contentId, episodeIndex);
            li.classList.remove('watched');
        }
        // Check if the download button was clicked
        else if (e.target.closest('.episode-download-btn')) {
            openDownloadModal(episodeIndex);
        }
        // Otherwise, the click is to play the episode
        else {
            playEpisode(li, contentId, episodeIndex);
        }
    });

    // --- Modal Management (for Download Modal) ---
    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
    }

    function hideModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', hideModals);
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModals();
        });
    });

    // --- Initial Page Load ---
    let seasonsData, specialsData;

    async function initializePlayer() {
        // 1. Fetch data
        const data = await fetchData();
        seasonsData = data.seasonsData;
        specialsData = data.specialsData;
        const dataSource = isSpecial ? specialsData : seasonsData;
        const seasonData = dataSource ? dataSource[contentId] : null;
        // 1. Handle case where content ID is missing
        if (!seasonData || !videoElement) {
            handleContentNotFound();
            return;
        }
        updateUI(contentId, seasonData);

        if (seasonData.episodes && seasonData.episodes.length > 0) {
            const lastPlayed = getLastPlayed();
            const lastPlayedKey = progressPrefix + contentId;
            let episodeToLoadIndex = 0; // Default to the first episode
            if (lastPlayed[lastPlayedKey] !== undefined) {
                const savedIndex = lastPlayed[lastPlayedKey];
                // Ensure the saved index is valid for the current content
                if (savedIndex >= 0 && savedIndex < seasonData.episodes.length) {
                    episodeToLoadIndex = savedIndex;
                }
            }

            const episodeElementToLoad = episodeListElement.querySelector(`li[data-index="${episodeToLoadIndex}"]`);
            if (episodeElementToLoad) {
                playEpisode(episodeElementToLoad, contentId, episodeToLoadIndex, false);
            }
        }
    }

    function handleContentNotFound() {
        if (titleElement) titleElement.textContent = "Content Not Found";
        if (descriptionElement) {
            const detailsWrapper = descriptionElement.parentElement;
            detailsWrapper.innerHTML = `
                <p style="font-size: 1.1rem; color: var(--text-muted);">The content you're looking for could not be loaded. This usually happens if you access this page directly without selecting a season or special.</p>
                <p style="margin-bottom: 30px;">Please return to the homepage to make a selection.</p>
                <a href="index.html" class="watch-button" style="text-decoration: none;">Go to Homepage</a>
            `;
            detailsWrapper.style.textAlign = 'center';
            detailsWrapper.style.padding = '20px 0';
        }

        // Hide irrelevant UI elements for a cleaner error page
        const videoWrapper = document.querySelector('.player-video-wrapper');
        const infoPanel = document.querySelector('.player-info-panel');

        if (videoWrapper) videoWrapper.style.display = 'none';
        if (infoPanel) infoPanel.style.display = 'none';
    }

    await initializePlayer();
});
